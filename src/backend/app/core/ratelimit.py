"""速率限制中间件（等保合规，无外部依赖）。

登录端点 10 次/分钟/IP，其他 API 120 次/分钟/IP。
超出返回 429 Too Many Requests。
"""

import time
from collections import defaultdict
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, default_limit: int = 120, window: int = 60):
        super().__init__(app)
        self.default_limit = default_limit
        self.window = window
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        # 登录端点使用更严格的限制
        is_login = request.url.path.endswith("/auth/login")
        limit = 10 if is_login else self.default_limit

        # 清理过期记录
        cutoff = now - self.window
        key = f"{client_ip}:{request.url.path}"
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

        if len(self._requests[key]) >= limit:
            return JSONResponse(
                status_code=429,
                content={"success": False, "code": "TOO_MANY_REQUESTS", "message": "请求过于频繁，请稍后再试", "data": None},
                headers={"Retry-After": str(self.window)},
            )

        self._requests[key].append(now)
        return await call_next(request)
