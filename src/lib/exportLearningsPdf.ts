export async function exportLearningsPdf(element: HTMLElement) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  await document.fonts.ready;
  const canvas = await html2canvas(element, {
    scale: 2,
    windowWidth: 1200,
    onclone: (doc) => {
      const table = doc.querySelector<HTMLElement>('[data-learnings-export]');
      if (!table) return;
      table.classList.add('learnings-pdf');
      table.style.width = '1120px';
      table.style.fontSize = '16px';
      table.parentElement?.style.setProperty('overflow', 'visible');
      // Swap the light logo for a dark variant so it stays visible on white paper.
      doc.querySelectorAll<HTMLElement>('img[data-learnings-logo-light]').forEach((img) => { img.style.display = 'none'; });
      doc.querySelectorAll<HTMLElement>('img[data-learnings-logo-dark]').forEach((img) => { img.style.display = 'inline-block'; });
    },
  });
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const availableWidth = pdf.internal.pageSize.getWidth() - 20;
  const availableHeight = pdf.internal.pageSize.getHeight() - 20;
  const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pdf.internal.pageSize.getWidth() - width) / 2, 10, width, height);
  pdf.save('workshop-learnings.pdf');
}