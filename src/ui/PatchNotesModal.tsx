import { useState, useEffect } from 'react';
import './PatchNotesModal.css';

const CURRENT_PATCH_VERSION = 'v1.1'; // Change this string to trigger the modal again

export default function PatchNotesModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const seenPatch = localStorage.getItem('seen_patch_version');
    if (seenPatch !== CURRENT_PATCH_VERSION) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('seen_patch_version', CURRENT_PATCH_VERSION);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="patch-notes-overlay">
      <div className="patch-notes-modal">
        <div className="patch-notes-header">
          <h3>Update Patch {CURRENT_PATCH_VERSION}</h3>
          <button className="patch-notes-close" onClick={handleClose}>&times;</button>
        </div>
        <div className="patch-notes-content">
          <h4>New Sleek UI Design!</h4>
          <ul>
            <li>Complete overhaul of the <strong>Dungeons</strong> and <strong>Plan</strong> pages.</li>
            <li>Introduced a new sleek, modern space-age theme.</li>
            <li>Upgraded the <strong>Gold</strong> page structure and visual layout.</li>
          </ul>
        </div>
        <div className="patch-notes-footer">
          <button className="patch-notes-btn" onClick={handleClose}>Got it!</button>
        </div>
      </div>
    </div>
  );
}
