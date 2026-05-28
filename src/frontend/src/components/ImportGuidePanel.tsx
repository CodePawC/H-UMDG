import React from "react";
import { Download, FileUp } from "lucide-react";
import type { ImportGuide } from "../lib/importGuides";

export function ImportGuidePanel({ guide }: { guide: ImportGuide }) {
  return (
    <div className="import-guide" aria-label="Import data requirements">
      <div className="import-guide-main">
        <FileUp size={20} />
        <div>
          <span>What data should this import use?</span>
          <strong>{guide.title}</strong>
          <p>{guide.purpose}</p>
        </div>
      </div>

      <div className="import-guide-grid">
        <div>
          <span>Accepted file</span>
          <strong>{guide.acceptedFiles}</strong>
        </div>
        <div>
          <span>Template or sample</span>
          <strong>{guide.samplePath.split("/").pop()}</strong>
          {guide.downloadUrl ? (
            <div className="download-line">
              <a className="tool-button" href={guide.downloadUrl} download>
                <Download size={16} />
                Download template
              </a>
              {guide.sampleDownloadUrl ? (
                <a className="tool-button" href={guide.sampleDownloadUrl} download>
                  <Download size={16} />
                  {guide.sampleLabel ?? "Download sample"}
                </a>
              ) : null}
              <code>{guide.downloadUrl}</code>
            </div>
          ) : (
            <code>{guide.samplePath}</code>
          )}
          <small>
            <span>Repository source:</span> <code>{guide.samplePath}</code>
          </small>
        </div>
      </div>

      <div className="import-field-groups">
        <div className="import-guide-section">
          <span>Required fields</span>
          <div className="field-chip-list">
            {guide.requiredFields.map((field) => (
              <code className="field-chip" key={field}>
                {field}
              </code>
            ))}
          </div>
        </div>
        {guide.optionalFields.length > 0 ? (
          <div className="import-guide-section">
            <span>Useful optional fields</span>
            <div className="field-chip-list">
              {guide.optionalFields.map((field) => (
                <code className="field-chip field-chip-muted" key={field}>
                  {field}
                </code>
              ))}
            </div>
          </div>
        ) : null}
        <div className="import-guide-section">
          <span>Before upload</span>
          <ul className="import-guide-notes">
            {guide.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
