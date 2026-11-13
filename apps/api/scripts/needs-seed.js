// Exit code 0  = the database has no users yet  -> the first deploy should load the demo data + Owner login.
// Exit code 1  = users already exist            -> never touch the data (the seed WIPES everything).
// Used by the start command in apps/api/railway.json.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.count()
  .then((n) => { console.log(n === 0 ? '[deploy] empty database -> seeding' : `[deploy] ${n} user(s) found -> seed skipped`); return prisma.$disconnect().then(() => process.exit(n === 0 ? 0 : 1)); })
  .catch((e) => { console.error('[deploy] could not check the database:', e.message); process.exit(1); });
