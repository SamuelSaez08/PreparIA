const { getLeaderboard, getEstadisticasUsuario } = require('./src/services/gamificacion.service');

async function test() {
  try {
    const lb = await getLeaderboard('all_time');
    console.log('Leaderboard:', JSON.stringify(lb, null, 2));
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
  }
  process.exit();
}

test();
