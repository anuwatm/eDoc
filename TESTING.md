# Manual Testing Checklist

## Login

- Open `index.php`.
- Register or login.
- Confirm desktop, taskbar, and widgets render.

## File Windows

- Open **My Document** and **Public Document**.
- Open nested folders and use **Up**.
- Select one file, multi-select with `Ctrl`, then right-click.
- Test copy, paste, copy to, move to, rename, and ZIP download.

## Upload

- Drop a file into **My Document**.
- Confirm progress overlay appears and the file list refreshes.
- Open **Upload** from the taskbar.
- Upload files through the queue.
- Confirm no false `Invalid server response` appears after successful upload.

## Search And Recent

- Open **Search**.
- Search a known filename.
- Change context filter and sort mode.
- Click a result and confirm it opens or navigates correctly.
- Open **Recent Files** and confirm newest files appear first.

## Recycle Bin

- Delete a private file.
- Open **Recycle Bin** from the taskbar.
- Restore one item.
- Delete one item forever with **Del**.
- Use **Clear trash** and confirm private trash is empty.

## Preview

- Open image files: test zoom, fit, rotate, crop, apply, and download.
- Open `.docx`: confirm rendered document and download button.
- Open `.pdf`: test page navigation, zoom, fit width, and download.
- Open `.csv`: confirm Pivot Table and Raw Data tabs.

## Dashboard Wizard

- Open **Dashboard**.
- Select a CSV.
- Add filters, dimension, metric, aggregation, chart type, and title.
- Save a widget.
- Edit and delete saved widgets.

## Responsive UI

- Resize browser to small width.
- Confirm desktop icons wrap and do not overlap taskbar icons.
- Confirm Trash exists only on the taskbar.
- Open Search/Trash windows and check text truncation, button layout, and scroll.
