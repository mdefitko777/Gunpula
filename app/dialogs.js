export function openDialog(dialog) {
  if (!dialog || dialog.open) return;
  dialog.showModal();
}

export function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}
