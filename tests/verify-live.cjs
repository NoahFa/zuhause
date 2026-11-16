process.stdout.write('READY\n');
process.stdin.setEncoding('utf8');
process.stdin.once('data', async chunk => {
  try {
    const token = chunk.trim();
    const base = 'https://steuerkompass-zwei.charleen-quester.chatgpt.site/';
    const headers = { 'OAI-Sites-Authorization': `Bearer ${token}` };
    const page = await fetch(`${base}?app=10`, { headers });
    const html = await page.text();
    const asset = await fetch(`${base}features.js?v=10`, { headers });
    const js = await asset.text();
    process.stdout.write(`${JSON.stringify({
      pageStatus: page.status,
      assetStatus: asset.status,
      hasFeatureTag: /features\.js\?v=10/.test(html),
      hasBudgetRollover: /closePastBudgetMonths/.test(js),
      hasMontage: /Noahs Montagebereich/.test(js),
      hasWasteStreet: /284318/.test(js),
      contentType: asset.headers.get('content-type'),
    })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  }
});
