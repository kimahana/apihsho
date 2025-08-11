
const express = require('express');

const app = express();
app.use(express.json());

function ok(data){ return {success:true,status:"success",code:0,data}; }
function okList(list){ return ok({list}); }

// fake player data
const player = { 
  playerId: "RENDER_PLAYER_001",
  username: "RenderUser",
  displayName: "Render Player",
  level: 99,
  mmr: 2000
};

// currencies, characters, skins, items
const currencies = { gold: 999999, cash: 99999 };
const characters = [
  { id:"char_tim", name:"Tim", role:"Survivor", level:30, owned:true },
  { id:"char_belle", name:"Belle", role:"Hunter", level:25, owned:true }
];
const skins = [
  { id:"skin_tim_default", charId:"char_tim", name:"Default", owned:true },
  { id:"skin_belle_default", charId:"char_belle", name:"Default", owned:true }
];
const items = [
  { id:"item_syringe", name:"Syringe", count:99 },
  { id:"item_holy", name:"Holy Water", count:99 }
];
const products = [
  { id:"pack_1", name:"Starter Pack", price:0, currency:"cash" }
];

// Login endpoints
app.post(['/live/player/authen','/live/player/auth','/live/auth/login'], (req,res)=>{
  res.json(ok({ token:"render-token-123", playerId:player.playerId, profile:player }));
});

// Profile
app.get('/live/player/profile', (req,res)=> res.json(ok(player)));
app.get('/live/player/currency', (req,res)=> res.json(ok(currencies)));

// Lists
app.get(['/live/character/list','/live/character/listAll'], (req,res)=> res.json(okList(characters)));
app.get(['/live/skin/list','/live/skin/listAll'], (req,res)=> res.json(okList(skins)));
app.get(['/live/item/list','/live/item/listAll'], (req,res)=> res.json(okList(items)));
app.get(['/live/productListing/list','/live/product/list'], (req,res)=> res.json(okList(products)));

// Lobby / Matchmaking
app.post(['/live/lobby/create','/live/lobby/join','/live/lobby/leave','/live/matchmaking/search','/live/matchmaking/cancel'], (req,res)=>{
  res.json(ok({ lobbyId:"RENDER_LOBBY_1", members:[player.playerId] }));
});

// fallback for any /live route
app.all(/^\/live\/.*/i, (req,res)=> res.json(ok({})));

// root test
app.get('/', (req,res)=> res.send('HSHO Render API Running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`API running on port ${PORT}`));
