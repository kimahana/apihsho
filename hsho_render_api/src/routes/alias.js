import { Router } from 'express';

const router = Router();

const TOKENS = [
  'GetPlayerAPI','GetStoreAPI','GetLootboxAPI','GetRankedAPI',
  'GetQuestSkinAPI','GetCurseRelicAPI',
  'MailBoxGet','MailBoxRead','MailBoxClaim','MailBoxRemove',
  'Announcement','GetServerVersion',
  'LogReport','LogTransaction','LogStore','LogGetPlayerData'
];

// 1) logapi compatibility
router.use((req, res, next) => {
  const p = req.path || '/';
  const m = p.match(/^\/?logapi\/v1\/(check|add|report)\/(\w+)/i);
  if (m) {
    const action = m[1].toLowerCase();
    const subject = m[2].toLowerCase();
    // Map common subjects to known YGG log endpoints
    let target = '/YGG/LogReport';
    if (subject.includes('store')) target = '/YGG/LogStore';
    else if (subject.includes('transaction')) target = '/YGG/LogTransaction';
    else if (subject.includes('gacha')) target = '/YGG/LogStore';
    else if (subject.includes('match') || subject.includes('ingame') || subject.includes('penalty') || subject.includes('errorlog')) target = '/YGG/LogReport';
    req.url = target + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    return next();
  }
  next();
});

// 2) any path ending with a known token -> /YGG/<token>
router.use((req, res, next) => {
  const path = req.path || '/';
  const m = path.match(new RegExp(`(?:^|/)(${TOKENS.join('|')})$`));
  if (m) {
    const token = m[1];
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `/YGG/${token}${qs}`;
  }
  next();
});

export default router;
