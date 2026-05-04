'use strict';

require('dotenv').config();
const { pool } = require('../src/config/db');

const treeData = [
  {
    label: 'Historia', icon: '📜',
    children: [
      {
        label: 'Historia de Colombia', icon: '🇨🇴',
        children: [
          {
            label: 'Independencia', icon: '⚔️',
            children: [
              { label: 'Simón Bolívar', icon: '🦅', content: 'Líder militar y político venezolano, figura destacada de la emancipación hispanoamericana. Lideró las campañas que dieron la independencia a Colombia, Venezuela, Ecuador, Perú y Bolivia.' },
              { label: 'Francisco de Paula Santander', icon: '📋', content: 'Militar y político colombiano, conocido como "El Hombre de las Leyes". Fue pieza clave en la consolidación institucional de la Gran Colombia.' },
              { label: 'Antonio Nariño', icon: '📰', content: 'Periodista, político y militar colombiano, precursor de la independencia. Tradujo y publicó la "Declaración de los Derechos del Hombre y del Ciudadano".' },
            ]
          },
          {
            label: 'La Violencia (1948-1958)', icon: '🔴',
            children: [
              { label: 'El Bogotazo', icon: '💥', content: 'Serie de disturbios ocurridos en la capital de Colombia en 1948, consecuencia del asesinato al líder popular Jorge Eliécer Gaitán.' },
              { label: 'Frente Nacional', icon: '🤝', content: 'Pacto político entre los partidos Liberal y Conservador (1958-1974) para alternarse el poder y pacificar el país tras la época de La Violencia.' },
            ]
          },
          {
            label: 'Proceso de Paz', icon: '🕊️',
            children: [
              { label: 'Acuerdo de La Habana 2016', icon: '📝', content: 'Acuerdo firmado entre el Gobierno de Colombia (Juan Manuel Santos) y las FARC-EP para poner fin a más de 50 años de conflicto armado.' },
              { label: 'FARC y reinserción', icon: '🌱', content: 'Proceso de transición a la vida civil y participación política democrática (partido Comunes) por parte de los excombatientes de las FARC.' },
            ]
          },
        ]
      },
      {
        label: 'Historia Universal', icon: '🌍',
        children: [
          {
            label: 'Revolución Francesa', icon: '🗽',
            children: [
              { label: 'Causas', icon: '⚡', content: 'Desigualdad social extrema, crisis económica, influencia de las ideas de la Ilustración y monarquía absolutista ineficiente.' },
              { label: 'La Guillotina y el Terror', icon: '⚔️', content: 'Período liderado por Robespierre, caracterizado por ejecuciones masivas de opositores mediante la guillotina para "proteger" la revolución.' },
              { label: 'Napoleón Bonaparte', icon: '👑', content: 'General militar que tomó el poder mediante un golpe de estado en 1799, consolidando y expandiendo ideales revolucionarios (y su propio imperio) por Europa.' },
            ]
          },
          {
            label: 'Primera y Segunda Guerra Mundial', icon: '🌐',
            children: [
              { label: 'Causas WWI', icon: '💣', content: 'Imperialismo, militarismo, sistema de alianzas en Europa y el asesinato del Archiduque Francisco Fernando en 1914.' },
              { label: 'Causas WWII', icon: '⚙️', content: 'Resentimiento por el Tratado de Versalles, ascenso de totalitarismos (nazismo y fascismo), expansionismo y política de apaciguamiento.' },
              { label: 'Consecuencias', icon: '🏴', content: 'Caída de grandes imperios, creación de la ONU, inicio de la Guerra Fría y descolonización en África y Asia.' },
            ]
          },
          {
            label: 'Guerra Fría', icon: '❄️',
            children: [
              { label: 'EEUU vs URSS', icon: '🚀', content: 'Enfrentamiento político, económico, social, militar, informativo y científico (carrera espacial) entre el bloque capitalista (EEUU) y el bloque comunista (URSS).' },
              { label: 'Caída del Muro de Berlín', icon: '🧱', content: 'Evento histórico en 1989 que simbolizó el fin de la Guerra Fría, la reunificación alemana y el colapso inminente de la Unión Soviética.' },
            ]
          },
        ]
      },
    ]
  },
  {
    label: 'Geografía', icon: '🗺️',
    children: [
      {
        label: 'Geografía de Colombia', icon: '🏔️',
        children: [
          {
            label: 'Regiones naturales', icon: '🌿',
            children: [
              { label: 'Región Andina', icon: '⛰️', content: 'Zona montañosa del país, dominada por la Cordillera de los Andes. Es la más poblada y concentra la mayor actividad económica.' },
              { label: 'Región Caribe', icon: '🌊', content: 'Ubicada al norte de Colombia, destaca por sus llanuras costeras, turismo y rica cultura influenciada por ancestros africanos e indígenas.' },
              { label: 'Región Pacífica', icon: '🌧️', content: 'Conocida por ser una de las zonas más biodiversas y lluviosas del mundo, habitada mayormente por comunidades afrocolombianas.' },
              { label: 'Región Amazónica', icon: '🌳', content: 'Extensa planicie selvática en el sur del país. Fundamental para el equilibrio climático global.' },
              { label: 'Región Orinoquía', icon: '🦌', content: 'Llanuras orientales dedicadas predominantemente a la ganadería extensiva y la extracción petrolera.' },
              { label: 'Región Insular', icon: '🏝️', content: 'Comprende todas las islas de Colombia, incluyendo San Andrés, Providencia y Santa Catalina en el mar Caribe.' },
            ]
          },
          {
            label: 'Ríos principales', icon: '🌊',
            children: [
              { label: 'Río Magdalena', icon: '💧', content: 'Principal arteria fluvial de Colombia, crucial para el comercio, transporte e historia del país.' },
              { label: 'Río Cauca', icon: '💧', content: 'Segundo río más importante de Colombia, fluye entre las cordilleras Occidental y Central.' },
              { label: 'Río Amazonas', icon: '💧', content: 'El río más caudaloso del mundo. Colombia comparte una porción de este río y su inmensa cuenca.' },
            ]
          },
        ]
      },
      {
        label: 'Geografía Universal', icon: '🌐',
        children: [
          { label: 'Continentes y océanos', icon: '🗺️', content: 'La Tierra se divide en continentes (América, Europa, Asia, África, Oceanía, Antártida) y grandes océanos (Pacífico, Atlántico, Índico, Ártico, Antártico).' },
          { label: 'Cambio climático', icon: '🌡️', content: 'Alteración global del clima a largo plazo, exacerbada por la actividad humana (gases de efecto invernadero), provocando calentamiento global y fenómenos extremos.' },
        ]
      },
    ]
  },
  {
    label: 'Ciencias Políticas', icon: '🏛️',
    children: [
      {
        label: 'Constitución de 1991', icon: '📜',
        children: [
          { label: 'Derechos fundamentales', icon: '⚖️', content: 'Garantías inherentes a la dignidad humana (ej: derecho a la vida, libertad, igualdad, tutela).' },
          { label: 'Mecanismos de participación', icon: '🗳️', content: 'Herramientas democráticas como el voto, plebiscito, referendo, consulta popular, cabildo abierto e iniciativa legislativa.' },
          { label: 'Ramas del poder público', icon: '🏛️', content: 'El poder se divide en Rama Ejecutiva (Presidente), Legislativa (Congreso) y Judicial (Cortes y Jueces) para garantizar contrapesos.' },
        ]
      },
      {
        label: 'Sistemas de gobierno', icon: '🏛️',
        children: [
          { label: 'Democracia', icon: '🗳️', content: 'Sistema político donde el poder recae en el pueblo, quien lo ejerce directamente o a través de representantes elegidos.' },
          { label: 'Autoritarismo', icon: '👊', content: 'Régimen donde el poder se concentra en una persona o grupo cerrado, limitando fuertemente las libertades políticas y civiles.' },
          { label: 'Monarquía', icon: '👑', content: 'Forma de gobierno en la que la jefatura del Estado reside en una persona (rey o reina), generalmente de forma hereditaria y vitalicia.' },
        ]
      },
    ]
  },
  {
    label: 'Economía', icon: '💰',
    children: [
      {
        label: 'Conceptos básicos', icon: '📊',
        children: [
          { label: 'PIB y crecimiento económico', icon: '📈', content: 'El Producto Interno Bruto es la suma del valor de todos los bienes y servicios producidos en un país. Su aumento sostenido indica crecimiento económico.' },
          { label: 'Inflación y deflación', icon: '💹', content: 'Inflación: aumento generalizado y continuo de los precios. Deflación: disminución generalizada de los precios. Ambos afectan el poder adquisitivo.' },
          { label: 'Desempleo', icon: '👷', content: 'Situación en la que personas en edad y disposición de trabajar no encuentran empleo. Se mide con la tasa de desempleo.' },
        ]
      },
      {
        label: 'Comercio internacional', icon: '🚢',
        children: [
          { label: 'Exportaciones e importaciones', icon: '📦', content: 'Exportaciones: bienes o servicios vendidos a otros países. Importaciones: bienes o servicios comprados del exterior.' },
          { label: 'TLC y acuerdos comerciales', icon: '🤝', content: 'Tratados de Libre Comercio: acuerdos entre países para reducir aranceles y barreras comerciales, fomentando el intercambio mutuo.' },
        ]
      },
    ]
  },
];

async function insertNode(client, node, id_materia, id_padre = null, nivel = 1, orden = 0) {
  const nivelBd = Math.min(nivel, 3);
  const result = await client.query(
    `INSERT INTO nodo_aprendizaje (nombre, id_materia, id_nivel, id_padre, orden, descripcion) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [node.label, id_materia, nivelBd, id_padre, orden, node.icon]
  );
  
  const id = result.rows[0].id;
  
  if (node.content) {
    await client.query(
      `INSERT INTO material_estudio (id_nodo, titulo, tipo, contenido) 
       VALUES ($1, $2, $3, $4)`,
      [id, `Resumen: ${node.label}`, 'texto', node.content]
    );
  }

  if (node.children && node.children.length > 0) {
    for (let i = 0; i < node.children.length; i++) {
      await insertNode(client, node.children[i], id_materia, id, nivel + 1, i + 1);
    }
  }
}

async function runSeed() {
  console.log('Iniciando poblamiento de nodos de Ciencias Sociales...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if materia exists (id 1 should be Ciencias Sociales)
    const { rows: materias } = await client.query('SELECT id FROM materia WHERE id = 1');
    if (materias.length === 0) {
      console.log('Materia Ciencias Sociales no encontrada, abortando.');
      return;
    }
    
    // Clear existing nodes for materia 1
    await client.query('DELETE FROM nodo_aprendizaje WHERE id_materia = 1');
    
    // Insert new tree
    for (let i = 0; i < treeData.length; i++) {
      await insertNode(client, treeData[i], 1, null, 1, i + 1);
    }

    await client.query('COMMIT');
    console.log('✅ Poblamiento completado exitosamente.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante el poblamiento:', e);
  } finally {
    client.release();
    pool.end();
  }
}

runSeed();
