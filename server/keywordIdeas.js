const KEYWORD_CLUSTERS = [
  {
    category: 'Fiber & Handmade Craft',
    triggers: ['yarn', 'knit', 'knitting', 'crochet', 'fiber', 'fibre', 'wool', 'craft', 'embroidery', 'sewing'],
    ideas: [
      ['indie yarn dyers', 'Buyer keyword', 'Small-batch supplies, paid patterns, and creator-led education.'],
      ['yarn dyeing', 'Tool keyword', 'Repeatable process with supplies, recipes, calculators, and classes.'],
      ['knitting machine repair', 'Pain keyword', 'Hardware problems create strong troubleshooting and service intent.'],
      ['sock knitting patterns', 'Adjacent niche', 'Specific, repeat buyers and pattern marketplaces.'],
      ['crochet plushie patterns', 'Buyer keyword', 'Pattern packs, kits, and tutorial bundles monetize well.'],
      ['weaving loom beginners', 'Pain keyword', 'Beginners need setup guides, project plans, and equipment help.'],
      ['spinning wheel maintenance', 'Pain keyword', 'Specialized equipment creates repair and parts demand.'],
      ['ravelry alternatives', 'Tool keyword', 'Community software dissatisfaction can reveal SaaS opportunities.']
    ]
  },
  {
    category: 'Retro Gaming & Repair',
    triggers: ['gameboy', 'game boy', 'gba', 'retro', 'console', 'nintendo', 'cartridge', 'handheld'],
    ideas: [
      ['gameboy advance sp repair', 'Pain keyword', 'Parts, tools, and repair services have clear buying intent.'],
      ['gba usb c mod', 'Tool keyword', 'Modding communities need guides, kits, and troubleshooting.'],
      ['retro cartridge battery replacement', 'Pain keyword', 'Recurring repair problem with tool and part demand.'],
      ['game boy screen mod', 'Buyer keyword', 'Hardware upgrades generate comparison and product questions.'],
      ['retro console capacitor replacement', 'Pain keyword', 'Specialist repair topic with service monetization potential.'],
      ['everdrive alternatives', 'Recommendation keyword', 'Comparison searches reveal budget and purchase intent.']
    ]
  },
  {
    category: 'Maker Hardware',
    triggers: ['3d', 'printing', 'printer', 'laser', 'cnc', 'arduino', 'raspberry', 'pi', 'electronics'],
    ideas: [
      ['resin 3d printing ventilation', 'Pain keyword', 'Safety and setup problems create product demand.'],
      ['bambu lab filament settings', 'Tool keyword', 'Preset libraries, calculators, and guides can monetize.'],
      ['laser cutter business', 'Buyer keyword', 'Business builders pay for templates, workflows, and training.'],
      ['arduino greenhouse automation', 'Adjacent niche', 'Specific project niche with parts and plans.'],
      ['cnc dust collection', 'Pain keyword', 'Workshop pain with hardware and layout solutions.'],
      ['raspberry pi home server', 'Tool keyword', 'DIY infrastructure buyers need scripts and setup packs.']
    ]
  },
  {
    category: 'Digital Tools & Templates',
    triggers: ['notion', 'excel', 'sheets', 'airtable', 'obsidian', 'template', 'automation', 'dashboard'],
    ideas: [
      ['notion habit tracker template', 'Buyer keyword', 'Templates are easy to test and sell quickly.'],
      ['excel inventory tracker', 'Tool keyword', 'Small businesses pay for done-for-you spreadsheets.'],
      ['google sheets invoice automation', 'Pain keyword', 'Admin pain with clear automation value.'],
      ['obsidian plugin workflow', 'Tool keyword', 'Power users pay for workflow and plugin support.'],
      ['airtable crm template', 'Buyer keyword', 'Operational templates sell to business users.'],
      ['power bi dashboard examples', 'Tool keyword', 'Professionals need reusable dashboards and training.']
    ]
  },
  {
    category: 'Home, Food & Lifestyle Systems',
    triggers: ['sourdough', 'espresso', 'fermentation', 'garden', 'home', 'diy', 'organizing', 'meal'],
    ideas: [
      ['sourdough starter troubleshooting', 'Pain keyword', 'Recurring beginner failure with course and guide potential.'],
      ['espresso grinder settings', 'Pain keyword', 'People buy gear and need calibration help.'],
      ['kombucha flavor recipes', 'Buyer keyword', 'Recipe packs, kits, and supplies monetize well.'],
      ['hydroponic lettuce setup', 'Adjacent niche', 'Specific beginner setup with equipment demand.'],
      ['garage workshop layout', 'Tool keyword', 'Planning templates and product recommendations fit.'],
      ['meal prep macro calculator', 'Tool keyword', 'Calculator and template demand with repeat usage.']
    ]
  },
  {
    category: 'Pet & Animal Care',
    triggers: ['dog', 'cat', 'aquarium', 'fish', 'reptile', 'chicken', 'beekeeping', 'bird'],
    ideas: [
      ['planted aquarium algae control', 'Pain keyword', 'Recurring frustration with product and guide demand.'],
      ['shrimp tank setup', 'Buyer keyword', 'Specific equipment and supply-heavy niche.'],
      ['reptile enclosure humidity', 'Pain keyword', 'Care problem with sensors, guides, and products.'],
      ['dog agility training at home', 'Buyer keyword', 'Owners buy plans, equipment, and coaching.'],
      ['chicken coop predator proofing', 'Pain keyword', 'Urgent problem with hardware solutions.'],
      ['raw feeding dogs calculator', 'Tool keyword', 'Calculator and meal planning products fit well.']
    ]
  }
];

const DEFAULT_IDEAS = [
  'indie yarn dyers',
  'gameboy advance sp repair',
  'resin 3d printing ventilation',
  'notion habit tracker template',
  'planted aquarium algae control',
  'sourdough starter troubleshooting',
  'garage workshop layout',
  'google sheets invoice automation'
];

const MONETIZATION_PATTERNS = [
  ['repair', 'Pain keyword', 'Repair searches often reveal urgent service and parts demand.'],
  ['calculator', 'Tool keyword', 'Calculators turn repeat decisions into a small SaaS or spreadsheet product.'],
  ['template', 'Buyer keyword', 'Template buyers are already looking for a shortcut.'],
  ['beginner mistakes', 'Pain keyword', 'Beginner mistakes become guides, checklists, and mini-courses.'],
  ['supplies', 'Buyer keyword', 'Supply searches reveal product bundles and affiliate angles.'],
  ['alternatives', 'Recommendation keyword', 'Alternative searches reveal dissatisfaction with existing products.'],
  ['setup checklist', 'Tool keyword', 'Setup friction is a strong signal for paid guides and planners.']
];

function normalize(value) {
  return (value || '').toLowerCase().trim();
}

function seedMatchesCluster(seed, cluster) {
  const cleanSeed = normalize(seed);
  if (!cleanSeed) return false;

  return cluster.triggers.some(trigger => cleanSeed.includes(trigger)) ||
    cluster.ideas.some(([keyword]) => keyword.includes(cleanSeed) || cleanSeed.includes(keyword));
}

function toIdea([keyword, type, reason], source = 'cluster') {
  return { keyword, type, reason, source };
}

function uniqueIdeas(ideas, limit = 18) {
  const seen = new Set();
  const output = [];

  for (const idea of ideas) {
    const key = normalize(idea.keyword);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(idea);
    if (output.length >= limit) break;
  }

  return output;
}

function buildSeedExpansions(seed) {
  const cleanSeed = normalize(seed);
  if (!cleanSeed) return [];

  return MONETIZATION_PATTERNS.map(([modifier, type, reason]) => toIdea([
    `${cleanSeed} ${modifier}`,
    type,
    reason
  ], 'seed-expansion'));
}

export function getKeywordIdeas(seed = '') {
  const cleanSeed = normalize(seed);
  const matchedClusters = KEYWORD_CLUSTERS.filter(cluster => seedMatchesCluster(cleanSeed, cluster));
  const clusters = matchedClusters.length > 0 ? matchedClusters : KEYWORD_CLUSTERS;

  const adjacentIdeas = uniqueIdeas(
    clusters.flatMap(cluster => cluster.ideas.map(idea => toIdea(idea, cluster.category))),
    cleanSeed ? 12 : 16
  );

  const seedExpansions = uniqueIdeas(buildSeedExpansions(cleanSeed), 8);
  const starterIdeas = DEFAULT_IDEAS
    .map(keyword => {
      const cluster = KEYWORD_CLUSTERS.find(item => item.ideas.some(([ideaKeyword]) => ideaKeyword === keyword));
      const idea = cluster?.ideas.find(([ideaKeyword]) => ideaKeyword === keyword);
      return idea ? toIdea(idea, cluster.category) : null;
    })
    .filter(Boolean);

  return {
    seed: cleanSeed,
    groups: [
      {
        title: cleanSeed ? `Search expansions for "${cleanSeed}"` : 'High-signal starter keywords',
        ideas: cleanSeed ? seedExpansions : starterIdeas
      },
      {
        title: cleanSeed ? 'Adjacent niche vocabulary' : 'Niche radar map',
        ideas: adjacentIdeas
      }
    ].filter(group => group.ideas.length > 0)
  };
}
