exports.up = async (knex) => {
  await knex.schema.alterTable('pregunta', (table) => {
    table.string('tema', 255).nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('pregunta', (table) => {
    table.dropColumn('tema');
  });
};
