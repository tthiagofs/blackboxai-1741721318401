// Redireciona para visualização/impressão direta via navegador (economizando 60MB de Chromium na Vercel)
export default async function handler(req, res) {
    const { id, projectId } = req.query || {};
    return res.redirect(302, `/apresentacao-print.html?id=${id || ''}&projectId=${projectId || ''}`);
}
