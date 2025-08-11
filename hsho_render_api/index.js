
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Fake API response for all /live/* requests
app.all('/live/*', (req, res) => {
    res.json({ status: 1, data: [], error: null });
});

// Root test endpoint
app.get('/', (req, res) => {
    res.send('HSHO Fake API Running');
});

app.listen(PORT, () => {
    console.log(`[HSHO] Fake API listening on port ${PORT}`);
});
