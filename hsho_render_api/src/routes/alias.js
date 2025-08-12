import { Router } from 'express';

const router = Router();

const TOKENS = [
  'GetPlayerAPI','GetStoreAPI','GetLootboxAPI','GetRankedAPI',
  'GetQuestSkinAPI','GetCurseRelicAPI',
  'MailBoxGet','MailBoxRead','MailBoxClaim','MailBoxRemove',
  'Announcement','GetServerVersion',
  'LogReport','LogTransaction','LogStore','LogGetPlayerData'
];

// logapi mapping table
const LOG_MAP = [
  { re: /\/logapi\/v\d+\/add/i, ygg: '/YGG/LogReport' },
  { re: /\/logapi\/v\d+\/report/i, ygg: '/YGG/LogReport' },
  { re: /\/logapi\/v\d+\/transaction/i, ygg: '/YGG/LogTransaction' },
  { re: /\/logapi\/v\d+\/store/i, ygg: '/YGG/LogStore' }
];

router.use((req, res, next) => {
  const path = req.path || '/';

  // logapi paths
  for (const m of LOG_MAP) {
    if (m.re.test(path)) {
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      req.url = `${m.ygg}${qs}`;
      return next();
    }
  }

  // generic tokens at end of path
  const m = path.match(new RegExp(`(?:^|/)(${TOKENS.join('|')})$`));
  if (m) {
    const token = m[1];
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `/YGG/${token}${qs}`;
  }
  return next();
});

export default router;
