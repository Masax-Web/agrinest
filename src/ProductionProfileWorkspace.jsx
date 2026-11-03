import { useMemo, useState } from 'react';

const cropCatalog = [
  { name: 'Maize', category: 'Grains', icon: 'grass' },
  { name: 'Rice', category: 'Grains', icon: 'water_drop' },
  { name: 'Wheat', category: 'Grains', icon: 'agriculture' },
  { name: 'Sorghum', category: 'Grains', icon: 'grass' },
  { name: 'Finger Millet', category: 'Grains', icon: 'grain' },
  { name: 'Pearl Millet', category: 'Grains', icon: 'grain' },
  { name: 'Barley', category: 'Grains', icon: 'grass' },
  { name: 'Oats', category: 'Grains', icon: 'grass' },
  { name: 'Common Beans', category: 'Legumes', icon: 'spa' },
  { name: 'Soybeans', category: 'Legumes', icon: 'eco' },
  { name: 'Pigeon Peas', category: 'Legumes', icon: 'spa' },
  { name: 'Cowpeas', category: 'Legumes', icon: 'spa' },
  { name: 'Green Grams', category: 'Legumes', icon: 'spa' },
  { name: 'Groundnuts', category: 'Legumes', icon: 'nutrition' },
  { name: 'Chickpeas', category: 'Legumes', icon: 'spa' },
  { name: 'Tomatoes', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Onions', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Potatoes', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Sweet Potatoes', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Cassava', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Bananas', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Cabbage', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Kale', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Spinach', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Carrots', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Sweet Peppers', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Avocados', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Mangoes', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Citrus', category: 'Horticulture', icon: 'nutrition' },
  { name: 'Sunflower', category: 'Oilseeds', icon: 'wb_sunny' },
  { name: 'Sesame', category: 'Oilseeds', icon: 'spa' },
  { name: 'Castor', category: 'Oilseeds', icon: 'eco' },
  { name: 'Coffee', category: 'Cash Crops', icon: 'local_cafe' },
  { name: 'Tea', category: 'Cash Crops', icon: 'local_cafe' },
  { name: 'Cotton', category: 'Cash Crops', icon: 'filter_vintage' },
  { name: 'Cashew', category: 'Cash Crops', icon: 'nutrition' },
  { name: 'Sugarcane', category: 'Cash Crops', icon: 'grass' },
  { name: 'Tobacco', category: 'Cash Crops', icon: 'eco' },
  { name: 'Sisal', category: 'Cash Crops', icon: 'eco' },
  { name: 'Timber', category: 'Other', icon: 'forest' },
];

const livestockCatalog = [
  { name: 'Cattle', category: 'Large livestock', icon: 'pets' },
  { name: 'Goats', category: 'Small livestock', icon: 'pets' },
  { name: 'Sheep', category: 'Small livestock', icon: 'pets' },
  { name: 'Pigs', category: 'Small livestock', icon: 'pets' },
  { name: 'Rabbits', category: 'Small livestock', icon: 'cruelty_free' },
  { name: 'Chickens', category: 'Poultry', icon: 'egg_alt' },
  { name: 'Ducks', category: 'Poultry', icon: 'egg_alt' },
  { name: 'Turkeys', category: 'Poultry', icon: 'egg_alt' },
  { name: 'Quail', category: 'Poultry', icon: 'egg_alt' },
  { name: 'Fish', category: 'Aquaculture & bees', icon: 'set_meal' },
  { name: 'Bees', category: 'Aquaculture & bees', icon: 'hive' },
  { name: 'Donkeys', category: 'Large livestock', icon: 'pets' },
  { name: 'Camels', category: 'Large livestock', icon: 'pets' },
];

const cropCategories = ['All Crops', 'Grains', 'Legumes', 'Horticulture', 'Oilseeds', 'Cash Crops', 'Other'];
const livestockCategories = ['All Livestock', 'Large livestock', 'Small livestock', 'Poultry', 'Aquaculture & bees'];
const visibleItemLimit = 8;

function getProfileSelections(profile, key, legacyKey, catalog) {
  const saved = Array.isArray(profile?.[key])
    ? profile[key].filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
    : String(profile?.[legacyKey] || '').split(',').map((value) => value.trim()).filter(Boolean);
  const knownNames = new Set(catalog.map((item) => item.name.toLowerCase()));
  return {
    selected: [...new Set(saved)],
    custom: saved
      .filter((name) => !knownNames.has(name.toLowerCase()))
      .map((name) => ({ name, category: 'Other', icon: 'yard' })),
  };
}

function ProductionProfileWorkspace({ profile, onProfileSave, onBack }) {
  const initialCrops = getProfileSelections(profile, 'selectedCrops', 'crops', cropCatalog);
  const initialLivestock = getProfileSelections(profile, 'selectedLivestock', 'livestockTypes', livestockCatalog);
  const [activeTab, setActiveTab] = useState('crops');
  const [activeCategory, setActiveCategory] = useState('All Crops');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selectedCrops, setSelectedCrops] = useState(initialCrops.selected);
  const [selectedLivestock, setSelectedLivestock] = useState(initialLivestock.selected);
  const [customCrops] = useState(initialCrops.custom);
  const [customLivestock] = useState(initialLivestock.custom);
  const [saveError, setSaveError] = useState('');
  const items = activeTab === 'crops'
    ? [...cropCatalog, ...customCrops]
    : [...livestockCatalog, ...customLivestock];
  const categories = activeTab === 'crops' ? cropCategories : livestockCategories;
  const selectedItems = activeTab === 'crops' ? selectedCrops : selectedLivestock;
  const setSelectedItems = activeTab === 'crops' ? setSelectedCrops : setSelectedLivestock;

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = activeCategory === categories[0] || item.category === activeCategory;
      const matchesSearch = !query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, categories, items, search]);
  const displayedItems = showAll || search.trim() || activeCategory !== categories[0]
    ? visibleItems
    : visibleItems.slice(0, visibleItemLimit);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setActiveCategory(tab === 'crops' ? cropCategories[0] : livestockCategories[0]);
    setSearch('');
    setShowAll(false);
  };

  const toggleItem = (name) => {
    setSelectedItems((current) => current.includes(name)
      ? current.filter((item) => item !== name)
      : [...current, name]);
    setSaveError('');
  };

  const saveAndContinue = () => {
    const saved = onProfileSave({
      ...profile,
      selectedCrops,
      selectedLivestock,
      crops: selectedCrops.join(', '),
      livestockTypes: selectedLivestock,
    });
    if (!saved) {
      setSaveError('Could not save your production profile on this device. Check available storage and try again.');
      return;
    }
    onBack();
  };

  const skipForNow = () => onBack();

  return (
    <main className="farmer-workspace production-profile-page" aria-label="Farm production profile">
      <header className="production-profile-topbar">
        <button type="button" className="production-profile-back" onClick={onBack} aria-label="Back to farmer dashboard">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="production-profile-step">
          <span>FARMER WORKSPACE</span>
          <strong>Farm Profile</strong>
        </div>
        <div className="production-profile-progress" aria-label="Farm profile">
          <span className="complete" /><span className="complete" /><span /><span />
        </div>
      </header>

      <div className="production-profile-content">
        <div className="production-profile-intro">
          <span className="farmer-workspace-eyebrow">YOUR FARM PROFILE</span>
          <h1>What do you produce?</h1>
          <p>Select the crops and livestock you currently manage to tailor your AGRI-NEST experience.</p>
        </div>

        <div className="production-profile-tabs" role="tablist" aria-label="Production type">
          <button type="button" role="tab" aria-selected={activeTab === 'crops'} className={activeTab === 'crops' ? 'active' : ''} onClick={() => switchTab('crops')}>Crops</button>
          <button type="button" role="tab" aria-selected={activeTab === 'livestock'} className={activeTab === 'livestock' ? 'active' : ''} onClick={() => switchTab('livestock')}>Livestock</button>
        </div>

        <label className="production-profile-search">
          <span className="material-symbols-outlined">search</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={activeTab === 'crops' ? 'Search for maize, wheat, coffee...' : 'Search for cattle, goats, poultry...'} />
        </label>

        <div className="production-profile-browser">
          <aside className="production-profile-categories" aria-label={`${activeTab} categories`}>
            <h2>Categories</h2>
            {categories.map((category) => {
              const count = category === categories[0] ? items.length : items.filter((item) => item.category === category).length;
              return (
                <button type="button" key={category} className={activeCategory === category ? 'active' : ''} onClick={() => { setActiveCategory(category); setShowAll(true); }}>
                  <span>{category}</span><small>{count}</small>
                </button>
              );
            })}
          </aside>

          <section className="production-profile-results" aria-live="polite">
            {displayedItems.length ? (
              <div className="production-profile-grid">
                {displayedItems.map((item) => {
                  const isSelected = selectedItems.includes(item.name);
                  return (
                    <button
                      type="button"
                      key={`${activeTab}-${item.name}`}
                      className={`production-item-card${isSelected ? ' selected' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => toggleItem(item.name)}
                    >
                      <span className="production-item-check" aria-hidden="true">
                        {isSelected && <span className="material-symbols-outlined">check</span>}
                      </span>
                      <span className="production-item-icon"><span className="material-symbols-outlined">{item.icon}</span></span>
                      <span className="production-item-name">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="production-profile-empty">No {activeTab} match "{search}". Try another search or category.</p>
            )}
            {visibleItems.length > visibleItemLimit && activeCategory === categories[0] && !search.trim() && (
              <button type="button" className="production-profile-show-more" onClick={() => setShowAll((current) => !current)}>
                {showAll ? 'Show fewer' : `Show more ${activeTab}`}
              </button>
            )}
          </section>
        </div>
      </div>

      <footer className="production-profile-actions">
        <div className="production-profile-selection-count">
          <span>{selectedCrops.length + selectedLivestock.length}</span>
          <strong>Items selected</strong>
        </div>
        <div className="production-profile-action-buttons">
          {saveError && <p role="alert">{saveError}</p>}
          <button type="button" className="production-profile-skip" onClick={skipForNow}>Skip for now</button>
          <button type="button" className="production-profile-continue" onClick={saveAndContinue}>
            Continue <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </footer>
    </main>
  );
}

export default ProductionProfileWorkspace;
