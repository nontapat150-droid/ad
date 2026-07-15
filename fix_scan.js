const fs = require('fs');

// 1. Fix InventoryReceivePage.jsx
let receivePath = 'frontend/src/pages/InventoryReceivePage.jsx';
let content = fs.readFileSync(receivePath, 'utf8');

// Replace handleSnChange
const snChangeOld =   const handleSnChange = (e) => {
    // Allow alphanumeric and dash characters (uppercase for consistency, or keep as is)
    // We remove whitespace and special symbols just in case, but keep letters/numbers.
    const value = e.target.value.replace(/[^A-Za-z0-9-]/g, '');
    setSn(value);
    if (inputType === 'scan' && value.length >= 12) {
        handleAddToStaging(null, value);
    }
  };;
const snChangeNew =   const handleSnChange = (e) => {
    const value = e.target.value.replace(/[^A-Za-z0-9-]/g, '');
    setSn(value);
  };;
content = content.replace(snChangeOld, snChangeNew);

// Replace handleSnKeyDown
const snKeyDownOld =   const handleSnKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddToStaging(); }
  };;
const snKeyDownNew =   const handleSnKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddToStaging(null, e.target.value.replace(/[^A-Za-z0-9-]/g, '')); }
  };;
content = content.replace(snKeyDownOld, snKeyDownNew);

fs.writeFileSync(receivePath, content, 'utf8');


// 2. Fix InventoryDispatchPage.jsx
let dispatchPath = 'frontend/src/pages/InventoryDispatchPage.jsx';
let dispatchContent = fs.readFileSync(dispatchPath, 'utf8');

const dispatchChangeOld =                   onChange={(e) => {
                    setSnInput(e.target.value);
                    if (e.target.value.length >= 12) {
                      setTimeout(() => { if (snInputRef.current?.value.length >= 12) handleSearchSn(); }, 300);
                    }
                  }};
const dispatchChangeNew =                   onChange={(e) => {
                    setSnInput(e.target.value);
                  }};
dispatchContent = dispatchContent.replace(dispatchChangeOld, dispatchChangeNew);

fs.writeFileSync(dispatchPath, dispatchContent, 'utf8');

console.log('Fixed scan limitations');
