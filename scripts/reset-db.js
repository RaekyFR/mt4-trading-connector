
// nodejs/scripts/reset-db.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('⚠️  Réinitialisation de la base de données...');
  
  const confirm = process.argv[2] === '--force';
  if (!confirm) {
    console.log('Utilisez --force pour confirmer la réinitialisation');
    process.exit(1);
  }

  try {
    // Supprimer toutes les données dans l'ordre inverse des dépendances
    await prisma.auditLog.deleteMany({});
    console.log('✅ Logs d\'audit supprimés');

    await prisma.riskMetric.deleteMany({});
    console.log('✅ Métriques de risk supprimées');

    await prisma.order.deleteMany({});
    console.log('✅ Ordres supprimés');

    await prisma.signal.deleteMany({});
    console.log('✅ Signaux supprimés');

    await prisma.riskConfig.deleteMany({});
    console.log('✅ Configurations de risk supprimées');

    await prisma.strategy.deleteMany({});
    console.log('✅ Stratégies supprimées');

    await prisma.accountState.deleteMany({});
    console.log('✅ États de compte supprimés');

    console.log('\n🔧 Base de données réinitialisée !');
    console.log('Exécutez "npm run init-db" pour recréer les données de base');

  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
