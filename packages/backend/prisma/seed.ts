import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding IRM database...');

  // ─── Fähigkeiten ──────────────────────────────────────────────────────────
  const skills = await Promise.all([
    prisma.skill.upsert({
      where: { name: 'Gartenpflege' },
      update: {},
      create: { name: 'Gartenpflege', category: 'Garten', icon: 'Leaf', description: 'Allgemeine Gartenpflegearbeiten' },
    }),
    prisma.skill.upsert({
      where: { name: 'Winterdienst' },
      update: {},
      create: { name: 'Winterdienst', category: 'Winter', icon: 'Snowflake', description: 'Räumen und Streuen bei Winterwetter' },
    }),
    prisma.skill.upsert({
      where: { name: 'Sanitär' },
      update: {},
      create: { name: 'Sanitär', category: 'Handwerk', icon: 'Droplets', description: 'Sanitär- und Rohrleitungsarbeiten', requiresCertification: true },
    }),
    prisma.skill.upsert({
      where: { name: 'Elektroinstallation' },
      update: {},
      create: { name: 'Elektroinstallation', category: 'Handwerk', icon: 'Zap', description: 'Elektroarbeiten', requiresCertification: true },
    }),
    prisma.skill.upsert({
      where: { name: 'Reinigung' },
      update: {},
      create: { name: 'Reinigung', category: 'Reinigung', icon: 'Sparkles', description: 'Treppenhaus- und Gebäudereinigung' },
    }),
    prisma.skill.upsert({
      where: { name: 'Heizungstechnik' },
      update: {},
      create: { name: 'Heizungstechnik', category: 'Handwerk', icon: 'Flame', description: 'Heizungs- und Kesselwartung', requiresCertification: true },
    }),
    prisma.skill.upsert({
      where: { name: 'Allgemein' },
      update: {},
      create: { name: 'Allgemein', category: 'Allgemein', icon: 'Wrench', description: 'Allgemeine Hausmeistertätigkeiten' },
    }),
    prisma.skill.upsert({
      where: { name: 'Führerschein C1' },
      update: {},
      create: { name: 'Führerschein C1', category: 'Fahrzeug', icon: 'Truck', description: 'Führerschein Klasse C1 (LKW bis 7,5t)', requiresCertification: true },
    }),
  ]);

  const skillMap = Object.fromEntries(skills.map((s) => [s.name, s]));
  console.log(`  ${skills.length} Fähigkeiten angelegt`);

  // ─── Tätigkeitskatalog ────────────────────────────────────────────────────
  const activityTypes = [
    {
      code: 'RASEN',
      name: 'Rasenmähen',
      category: 'Garten',
      description: 'Rasenpflege inkl. Kantenschnitt',
      defaultDurationMin: 90,
      isRecurring: true,
      recurrenceInterval: 'BIWEEKLY',
      seasonStart: 4,
      seasonEnd: 10,
      icon: 'Scissors',
      color: '#22C55E',
      skills: ['Gartenpflege'],
    },
    {
      code: 'HECKE',
      name: 'Heckenschnitt',
      category: 'Garten',
      description: 'Heckenschnitt und Formschnitt',
      defaultDurationMin: 120,
      isRecurring: true,
      recurrenceInterval: 'MONTHLY',
      seasonStart: 4,
      seasonEnd: 10,
      icon: 'Scissors',
      color: '#16A34A',
      skills: ['Gartenpflege'],
    },
    {
      code: 'WINTER_RAEUM',
      name: 'Winterdienst Räumen',
      category: 'Winter',
      description: 'Schnee räumen auf Wegen und Zufahrten',
      defaultDurationMin: 60,
      isRecurring: true,
      recurrenceInterval: 'DAILY',
      seasonStart: 11,
      seasonEnd: 3,
      icon: 'Shovel',
      color: '#3B82F6',
      skills: ['Winterdienst'],
    },
    {
      code: 'WINTER_STREU',
      name: 'Winterdienst Streuen',
      category: 'Winter',
      description: 'Abstumpfen mit Streusalz oder Split',
      defaultDurationMin: 30,
      isRecurring: true,
      recurrenceInterval: 'DAILY',
      seasonStart: 11,
      seasonEnd: 3,
      icon: 'Snowflake',
      color: '#60A5FA',
      skills: ['Winterdienst'],
    },
    {
      code: 'REP_WASSER',
      name: 'Reparatur Wasserleitung',
      category: 'Reparatur',
      description: 'Rohrreparatur, Dichtungen, Ventile',
      defaultDurationMin: 120,
      isRecurring: false,
      icon: 'Droplets',
      color: '#0EA5E9',
      skills: ['Sanitär'],
    },
    {
      code: 'REP_ELEKTRO',
      name: 'Reparatur Elektro',
      category: 'Reparatur',
      description: 'Elektroreparaturen, Sicherungen, Leitungen',
      defaultDurationMin: 90,
      isRecurring: false,
      icon: 'Zap',
      color: '#EAB308',
      skills: ['Elektroinstallation'],
    },
    {
      code: 'REINIGUNG',
      name: 'Treppenhaus-Reinigung',
      category: 'Reinigung',
      description: 'Treppenhaus fegen und wischen, Briefkastenbereich',
      defaultDurationMin: 60,
      isRecurring: true,
      recurrenceInterval: 'WEEKLY',
      icon: 'Sparkles',
      color: '#A855F7',
      skills: ['Reinigung'],
    },
    {
      code: 'SPERR',
      name: 'Sperrmüll-Entsorgung',
      category: 'Entsorgung',
      description: 'Sperrmüll abholen und entsorgen',
      defaultDurationMin: 180,
      isRecurring: false,
      icon: 'Trash2',
      color: '#6B7280',
      skills: ['Allgemein'],
    },
    {
      code: 'WARTUNG_HEIZ',
      name: 'Heizungswartung',
      category: 'Wartung',
      description: 'Jährliche Heizungswartung und Abnahme',
      defaultDurationMin: 120,
      isRecurring: true,
      recurrenceInterval: 'MONTHLY',
      seasonStart: 9,
      seasonEnd: 11,
      icon: 'Flame',
      color: '#EF4444',
      skills: ['Heizungstechnik'],
    },
    {
      code: 'GARTEN_ALLG',
      name: 'Allgemeine Gartenpflege',
      category: 'Garten',
      description: 'Unkraut jäten, Bepflanzung pflegen, Laub kehren',
      defaultDurationMin: 60,
      isRecurring: true,
      recurrenceInterval: 'WEEKLY',
      seasonStart: 3,
      seasonEnd: 11,
      icon: 'TreePine',
      color: '#84CC16',
      skills: ['Gartenpflege'],
    },
  ];

  for (const at of activityTypes) {
    const { skills: skillNames, ...data } = at;
    await prisma.activityType.upsert({
      where: { code: data.code },
      update: {},
      create: {
        ...data,
        requiredSkills: {
          connect: skillNames
            .filter((n) => skillMap[n])
            .map((n) => ({ id: skillMap[n].id })),
        },
      },
    });
  }
  console.log(`  ${activityTypes.length} Tätigkeiten angelegt`);

  // ─── Beispiel-Zeitformeln ─────────────────────────────────────────────────
  const rasenActivity = await prisma.activityType.findUniqueOrThrow({
    where: { code: 'RASEN' },
  });

  await prisma.timeFormula.upsert({
    where: { id: 'seed-formula-rasen' },
    update: {},
    create: {
      id: 'seed-formula-rasen',
      name: 'Rasenmähen Standard',
      activityTypeId: rasenActivity.id,
      description: 'Berechnung: Grünfläche / Mähleistung × 60 + Rüstzeit + Kantenschnitt',
      resultUnit: 'minutes',
      formula: {
        expression: '({green_area_sqm} / {mow_rate_sqm_per_hour} * 60) + {setup_time_min} + {edge_trimming_min}',
      },
      variables: {
        green_area_sqm: { label: 'Grünfläche (m²)', source: 'property.green_area_sqm', type: 'number' },
        mow_rate_sqm_per_hour: { label: 'Mähleistung (m²/h)', type: 'number', default: 500 },
        setup_time_min: { label: 'Rüstzeit (min)', type: 'number', default: 15 },
        edge_trimming_min: { label: 'Kantenschnitt (min)', type: 'number', default: 10 },
      },
      defaultValues: {
        mow_rate_sqm_per_hour: 500,
        setup_time_min: 15,
        edge_trimming_min: 10,
      },
    },
  });

  const winterActivity = await prisma.activityType.findUniqueOrThrow({
    where: { code: 'WINTER_RAEUM' },
  });

  await prisma.timeFormula.upsert({
    where: { id: 'seed-formula-winter' },
    update: {},
    create: {
      id: 'seed-formula-winter',
      name: 'Winterdienst Räumen Standard',
      activityTypeId: winterActivity.id,
      description: 'Berechnung: Fläche / Räumleistung × 60 + Anfahrt-Puffer',
      resultUnit: 'minutes',
      formula: {
        expression: '({total_area_sqm} / {clear_rate_sqm_per_hour} * 60) + {buffer_min}',
      },
      variables: {
        total_area_sqm: { label: 'Zu räumende Fläche (m²)', source: 'property.total_area_sqm', type: 'number' },
        clear_rate_sqm_per_hour: { label: 'Räumleistung (m²/h)', type: 'number', default: 200 },
        buffer_min: { label: 'Anfahrt-Puffer (min)', type: 'number', default: 5 },
      },
      defaultValues: {
        clear_rate_sqm_per_hour: 200,
        buffer_min: 5,
      },
    },
  });

  const reinigungActivity = await prisma.activityType.findUniqueOrThrow({
    where: { code: 'REINIGUNG' },
  });

  await prisma.timeFormula.upsert({
    where: { id: 'seed-formula-reinigung' },
    update: {},
    create: {
      id: 'seed-formula-reinigung',
      name: 'Treppenreinigung Standard',
      activityTypeId: reinigungActivity.id,
      description: 'Berechnung: Etagen × Minuten/Etage + Eingangsbereich',
      resultUnit: 'minutes',
      formula: {
        expression: '({floors} * {min_per_floor}) + {entrance_min}',
      },
      variables: {
        floors: { label: 'Anzahl Etagen', source: 'property.floors', type: 'number' },
        min_per_floor: { label: 'Minuten pro Etage', type: 'number', default: 8 },
        entrance_min: { label: 'Eingangsbereich (min)', type: 'number', default: 10 },
      },
      defaultValues: {
        min_per_floor: 8,
        entrance_min: 10,
      },
    },
  });

  console.log('  3 Zeitformeln angelegt');
  console.log('Seeding abgeschlossen!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
