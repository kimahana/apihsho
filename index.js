
import express from 'express';

const app = express();
app.use(express.json());

function ts(){ return new Date().toISOString().replace('T',' ').replace('Z',''); }
const ok = (data)=>({success:true,status:"success",code:0,data});
const okList = (list)=> ok({list});

// Fake database
const DB = {
  account: { playerId:"VERCEL_0001", username:"VercelUser", displayName:"Vercel Player", level:30, mmr:1800 },
  currencies: { gold: 999999, cash: 9999 },
  characters: [
    { id:"char_tim", name:"Tim", role:"Survivor", level:15, owned:true },
    { id:"char_belle", name:"Belle", role:"Hunter", level:12, owned:true }
  ],
  skins: [
    { id:"skin_tim_default", charId:"char_tim", name:"Default", owned:true },
    { id:"skin_belle_default", charId:"char_belle", name:"Default", owned:true }
  ],
  items: [
    { id:"item_syringe", name:"Syringe", count:99 },
    { id:"item_holy", name:"Holy Water", count:99 }
  ],
  products:[{ id:"pack_1", name:"Starter Pack", price:0, currency:"cash" }]
};

// Auth
app.post(['/live/player/authen','/live/player/auth','/live/auth/login'], (req,res)=>{
  console.log(`[${ts()}] LOGIN ${req.originalUrl}`);
  res.json(ok({ token:"vercel-token-123", playerId:DB.account.playerId, profile:DB.account }));
});

// Profile
app.get('/live/player/profile', (req,res)=> res.json(ok(DB.account)));
app.get('/live/player/currency', (req,res)=> res.json(ok(DB.currencies)));

// Character / Skins / Items
app.get(['/live/character/list','/live/character/listAll'], (req,res)=> res.json(okList(DB.characters)));
app.get(['/live/skin/list','/live/skin/listAll'], (req,res)=> res.json(okList(DB.skins)));
app.get(['/live/item/list','/live/item/listAll'], (req,res)=> res.json(okList(DB.items)));
app.get(['/live/productListing/list','/live/product/list'], (req,res)=> res.json(okList(DB.products)));

// Lobby / Matchmaking
app.post(['/live/lobby/create','/live/lobby/join','/live/lobby/leave','/live/matchmaking/search','/live/matchmaking/cancel'], (req,res)=>{
  res.json(ok({ lobbyId:"VERCEL_LOBBY_1", members:[DB.account.playerId] }));
});

// Fallback for all /live routes
app.all(/^\/live\/.*/i, (req,res)=> res.json(ok({})));

// Root
app.get('/', (req,res)=> res.send('HSHO Vercel API Running'));

// Listen (Vercel will use process.env.PORT)
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`HSHO API running on port ${PORT}`));
