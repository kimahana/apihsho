import { Router } from 'express';

const router = Router();

// Known tokens we want to catch anywhere in the path
const TOKENS = [
  'GetPlayerAPI','GetStoreAPI','GetLootboxAPI','GetRankedAPI',
  'GetQuestSkinAPI','GetCurseRelicAPI',
  'MailBoxGet','MailBoxRead','MailBoxClaim','MailBoxRemove',
  'Announcement','GetServerVersion',
  'LogReport','LogTransaction','LogStore','LogGetPlayerData'
];

// Middleware: if the path ends with one of the tokens, rewrite to /YGG/<token>
router.use((req, res, next) => {
  const path = req.path || '/';
  const m = path.match(new RegExp(`(?:^|/)(${TOKENS.join('|')})$`));
  if (m) {
    const token = m[1];
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `/YGG/${token}${qs}`;
    // console.log('[alias]', path, '->', req.url);
  }
  next();
});

export default router;
