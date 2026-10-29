import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { TimeEntry } from '@/hooks/useTimeTracking';

const formatDate = (timestamp: TimeEntry['startedAt']) =>
  timestamp.toDate().toLocaleDateString('fr-FR');

const formatTime = (timestamp: TimeEntry['startedAt']) =>
  timestamp.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

const buildCsv = (entries: TimeEntry[]) => {
  const rows = [
    ['Date', 'Début', 'Fin', 'Durée (secondes)', 'Durée (HH:MM:SS)', 'Catégorie', 'Projet', 'Petit pas'],
    ...entries.map((entry) => [
      formatDate(entry.startedAt),
      formatTime(entry.startedAt),
      formatTime(entry.endedAt),
      String(entry.durationSeconds),
      formatDuration(entry.durationSeconds),
      entry.category,
      entry.project,
      entry.taskTitle ?? '',
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
};

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const buildPdfHtml = (entries: TimeEntry[]) => {
  const totalSeconds = entries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
  const rows = entries.map((entry) => `
    <tr>
      <td>${escapeHtml(formatDate(entry.startedAt))}</td>
      <td>${escapeHtml(formatTime(entry.startedAt))} – ${escapeHtml(formatTime(entry.endedAt))}</td>
      <td>${escapeHtml(entry.category)}</td>
      <td>${escapeHtml(entry.project || '—')}</td>
      <td>${escapeHtml(entry.taskTitle ?? '—')}</td>
      <td>${escapeHtml(formatDuration(entry.durationSeconds))}</td>
    </tr>
  `).join('');

  return `<!doctype html>
    <html lang="fr">
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body{font-family:Arial,sans-serif;color:#41473c;padding:28px}
          h1{font-size:22px;margin-bottom:4px}p{color:#858477;font-size:12px}
          .total{background:#eaf0e3;padding:14px;border-radius:10px;font-size:14px;margin:20px 0}
          table{width:100%;border-collapse:collapse;font-size:10px}
          th,td{text-align:left;padding:8px 5px;border-bottom:1px solid #eee9de}
          th{color:#65795f}
        </style>
      </head>
      <body>
        <h1>Qozy · Mon temps, à mon rythme</h1>
        <p>Exporté le ${escapeHtml(new Date().toLocaleDateString('fr-FR'))} · ${entries.length} sessions</p>
        <div class="total">Temps suivi au total : <strong>${formatDuration(totalSeconds)}</strong></div>
        <table>
          <thead><tr><th>Date</th><th>Horaire</th><th>Catégorie</th><th>Projet</th><th>Petit pas</th><th>Durée</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>`;
};

export async function exportTimeEntriesCsv(entries: TimeEntry[]) {
  if (!entries.length) throw new Error('Aucune session à exporter pour le moment.');
  const csv = buildCsv(entries);
  const filename = `qozy-temps-${new Date().toISOString().slice(0, 10)}.csv`;

  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
      throw new Error('Le téléchargement CSV n’est pas disponible dans ce navigateur.');
    }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(csv);
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('Le partage de fichiers n’est pas disponible sur cet appareil.');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Exporter mon temps' });
}

export async function exportTimeEntriesPdf(entries: TimeEntry[]) {
  if (!entries.length) throw new Error('Aucune session à exporter pour le moment.');
  const html = buildPdfHtml(entries);

  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('Le partage de fichiers n’est pas disponible sur cet appareil.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Exporter mon temps' });
}
