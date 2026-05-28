import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'saved_niches.json');

// Ensure database file and directory exist
function initDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

export function getSavedNiches() {
  initDatabase();
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading saved niches:', error);
    return [];
  }
}

export function saveNiche(nicheData) {
  initDatabase();
  try {
    const niches = getSavedNiches();
    // Check if it already exists by URL or ID
    const existsIndex = niches.findIndex(
      (n) => n.url === nicheData.url || (n.id && n.id === nicheData.id)
    );

    const newNiche = {
      id: nicheData.id || `niche-${Date.now()}`,
      name: nicheData.name,
      platform: nicheData.platform,
      url: nicheData.url,
      title: nicheData.title || nicheData.name,
      description: nicheData.description || '',
      memberCount: nicheData.memberCount ?? null,
      activeCount: nicheData.activeCount ?? null,
      activityLevel: nicheData.activityLevel || 'Medium',
      tags: nicheData.tags || [],
      isNsfw: nicheData.isNsfw || false,
      monetizationScore: nicheData.monetizationScore || 'Medium',
      nicheSpecificity: nicheData.nicheSpecificity || null,
      notes: nicheData.notes || '',
      ideas: nicheData.ideas || [],
      createdAt: nicheData.createdAt || new Date().toISOString(),
    };

    if (existsIndex >= 0) {
      // Update existing
      niches[existsIndex] = { ...niches[existsIndex], ...newNiche };
    } else {
      // Add new
      niches.push(newNiche);
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(niches, null, 2), 'utf-8');
    return newNiche;
  } catch (error) {
    console.error('Error saving niche:', error);
    throw error;
  }
}

export function deleteNiche(id) {
  initDatabase();
  try {
    let niches = getSavedNiches();
    niches = niches.filter((n) => n.id !== id);
    fs.writeFileSync(DATA_FILE, JSON.stringify(niches, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error deleting niche:', error);
    throw error;
  }
}
