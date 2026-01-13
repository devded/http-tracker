# Installation Guide

This project is distributed as a ZIP file through the **GitHub Releases** section.

## Prerequisites
- Google Chrome / Brave / Microsoft Edge (latest version)
---

## Installation Steps

### 1. Download the ZIP file
1. Go to the **Releases** page of this repository.
2. Download the latest available **ZIP file**.

---

### 2. Extract the ZIP file
- Right-click the downloaded ZIP file
- Select **Extract All** (Windows) or **Open with Archive Utility** (macOS)
- Make sure the extracted folder contains a `manifest.json` file

---

### 3. Load the extension in the browser
1. Open your browser and navigate to:
```

chrome://extensions

```
2. Enable **Developer mode** (toggle at the top-right).
3. Click **Load unpacked**.
4. Select the **extracted folder**.
5. The extension will now be installed and visible in the extensions list.

---

## Updating the Extension
1. Download the newer ZIP file from **Releases**.
2. Extract it.
3. Go to:
```

chrome://extensions

```
4. Click **Reload** on the existing extension  
**OR**
5. Remove the old version and load the new folder.

---

## Uninstalling
1. Open:
```

chrome://extensions

```
2. Find the extension.
3. Click **Remove**.

---

## Troubleshooting
- ❌ `manifest.json not found`  
✔ Ensure you selected the **extracted folder**, not the ZIP file
- ❌ Extension not loading  
✔ Check the browser console for errors
- ❌ ZIP downloaded but not extractable  
✔ Re-download from the Releases page

---

## Support
If you encounter any issues, please open an issue on GitHub with:
- Browser name & version
- Error message (if any)
- Screenshot (optional)
