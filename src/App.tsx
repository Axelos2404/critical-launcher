import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./index.css";

// Interface map matching our Rust UIInstance struct
interface InstanceData {
  id: number;
  name: string;
  version: string;
  type: string;
  playTime: string;
}

function App() {
  const [activeCategory, setActiveCategory] = useState("product");
  const [activeSubTab, setActiveSubTab] = useState("overview");

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<InstanceData | null>(null);

  // Form States
  const [instanceName, setInstanceName] = useState("");
  const [instanceVersion, setInstanceVersion] = useState("1.20.4");
  const [instanceLoader, setInstanceLoader] = useState("Vanilla");

  // Modrinth Fetch State
  const [discoverQuery, setDiscoverQuery] = useState("optimization");
  const [modpacks, setModpacks] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Local state to hold instances fetched from Rust
  const [instances, setInstances] = useState<InstanceData[]>([]);

  // Derived state for filtered categories
  const vanillaInstances = instances.filter((i) => i.type === "Vanilla");
  const moddedInstances = instances.filter((i) => i.type !== "Vanilla");

  // Account State
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const refreshInstances = async () => {
    try {
      const dbInstances = await invoke<InstanceData[]>("get_instances");
      setInstances(dbInstances);
    } catch (e) {
      console.error("Failed to fetch instances", e);
    }
  };

  useEffect(() => {
    refreshInstances();
    searchModrinth("optimization"); // Initial fetch
  }, []);

  const switchCategory = (category: string) => {
    setActiveCategory(category);
    if (category !== "product") setActiveSubTab("");
  };

  // --- ACTIONS ---

  const handleSaveInstance = async () => {
    if (!instanceName.trim()) {
      alert("Please enter an instance name.");
      return;
    }

    try {
      if (editingInstance) {
        // Update existing
        await invoke("update_instance", {
          oldName: editingInstance.name,
          newName: instanceName,
          version: instanceVersion,
          modLoader: instanceLoader,
        });
      } else {
        // Create new
        await invoke<string>("create_instance", {
          name: instanceName,
          version: instanceVersion,
          modLoader: instanceLoader,
        });
      }

      await refreshInstances();
      closeModal();
    } catch (error) {
      alert(`Failed to save instance:\n${error}`);
    }
  };

  const handleDeleteInstance = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete '${name}'?`);
    if (!confirmDelete) return;

    try {
      await invoke("delete_instance", { name });
      await refreshInstances();
    } catch (error) {
      alert(`Failed to delete instance:\n${error}`);
    }
  };

  const startOAuth = async () => {
    try {
      const response = await invoke<string>("start_microsoft_oauth");
      alert(response + "\n(This is where we map out the real Microsoft token scraper pipeline)");
    } catch (e) {
      console.error(e);
    }
  };

  const searchModrinth = async (query: string) => {
    setIsSearching(true);
    try {
      // Searching specifically for modpacks
      const res = await fetch(`https://api.modrinth.com/v2/search?query=${query}&facets=[["project_type:modpack"]]&limit=12`);
      const data = await res.json();
      setModpacks(data.hits);
    } catch (e) {
      console.error("Modrinth fetch failed:", e);
    }
    setIsSearching(false);
  };

  // UI Helpers
  const openNewModal = () => {
    setEditingInstance(null);
    setInstanceName("");
    setInstanceVersion("1.20.4");
    setInstanceLoader("Vanilla");
    setIsNewModalOpen(true);
  };

  const openEditModal = (instance: InstanceData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingInstance(instance);
    setInstanceName(instance.name);
    setInstanceVersion(instance.version);
    setInstanceLoader(instance.type);
    setIsNewModalOpen(true);
  };

  const closeModal = () => {
    setIsNewModalOpen(false);
    setEditingInstance(null);
  };

  return (
    <div className="flex h-screen w-screen bg-[#F3F4F6] text-[#111827] font-sans overflow-hidden relative">
      
      {/* --- CREATE / EDIT MODAL --- */}
      {isNewModalOpen && (
        <div className="absolute inset-0 bg-[#111827]/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-[24px] p-8 shadow-2xl w-full max-w-md border border-gray-100 transform transition-all">
            <h3 className="text-2xl font-bold mb-2">{editingInstance ? "Edit Instance" : "Create New Instance"}</h3>
            <p className="text-gray-500 text-sm mb-6">
              {editingInstance ? "Modify your environment settings." : "Set up a new Minecraft environment."}
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Instance Name</label>
                <input
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="e.g. My Awesome World"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Version</label>
                  <select
                    value={instanceVersion}
                    onChange={(e) => setInstanceVersion(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all appearance-none cursor-pointer"
                  >
                    <option value="1.20.4">1.20.4</option>
                    <option value="1.20.1">1.20.1</option>
                    <option value="1.19.4">1.19.4</option>
                    <option value="1.12.2">1.12.2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mod Loader</label>
                  <select
                    value={instanceLoader}
                    onChange={(e) => setInstanceLoader(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all appearance-none cursor-pointer"
                  >
                    <option value="Vanilla">Vanilla</option>
                    <option value="Fabric">Fabric</option>
                    <option value="Forge">Forge</option>
                    <option value="Quilt">Quilt</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInstance}
                className="bg-[#111827] hover:bg-[#1F2937] text-white px-6 py-2.5 rounded-xl font-semibold shadow-md active:scale-95 transition-all"
              >
                {editingInstance ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SIDEBAR --- */}
      <div className="w-64 flex flex-col pt-8 pb-6 px-4 shrink-0 justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10 px-2" data-tauri-drag-region>
            <div className="w-10 h-10 rounded-full border-2 border-[#111827] flex items-center justify-center flex-wrap gap-0.5 p-1 relative overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-[#111827]/10 rounded-full blur-[2px]"></div>
              <div className="w-[14px] h-[14px] bg-[#111827] rounded-tl-[8px]"></div>
              <div className="w-[14px] h-[14px] bg-[#111827] rounded-tr-[8px]"></div>
              <div className="w-[14px] h-[14px] bg-[#111827] rounded-bl-[8px]"></div>
              <div className="w-[14px] h-[14px] bg-[#111827] rounded-br-[8px]"></div>
            </div>
            <h1 className="text-xl font-bold select-none cursor-default truncate">Critical</h1>
          </div>

          <nav className="flex flex-col gap-1 overflow-y-auto pr-2 no-scrollbar">
            <button
              onClick={() => switchCategory("dashboard")}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                activeCategory === "dashboard" ? "bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] text-[#111827]" : "text-gray-500 hover:text-[#111827] hover:bg-black/5"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>
              Dashboard
            </button>

            <div className="mt-2">
              <button
                onClick={() => { switchCategory("product"); setActiveSubTab("overview"); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all ${
                  activeCategory === "product" && !activeSubTab ? "bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] text-[#111827]" : "text-[#111827] hover:bg-black/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M8 10V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"></path></svg>
                  My Instances
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${activeCategory === "product" ? "rotate-180" : ""}`}><path d="m18 15-6-6-6 6"></path></svg>
              </button>

              {activeCategory === "product" && (
                <div className="ml-5 pl-4 border-l-2 border-gray-200 mt-1 flex flex-col gap-1 overflow-hidden transition-all duration-300">
                  <button
                    onClick={() => setActiveSubTab("overview")}
                    className={`flex items-center justify-between w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeSubTab === "overview" ? "bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] text-[#111827]" : "text-gray-500 hover:text-[#111827] hover:bg-black/5"
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveSubTab("vanilla")}
                    className={`flex items-center justify-between w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeSubTab === "vanilla" ? "bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] text-[#111827]" : "text-gray-500 hover:text-[#111827] hover:bg-black/5"
                    }`}
                  >
                    Vanilla
                    {vanillaInstances.length > 0 && <span className="bg-[#FFDACC] text-[#D95D39] text-[10px] font-bold px-2 py-0.5 rounded-full">{vanillaInstances.length}</span>}
                  </button>
                  <button
                    onClick={() => setActiveSubTab("modded")}
                    className={`flex items-center justify-between w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeSubTab === "modded" ? "bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] text-[#111827]" : "text-gray-500 hover:text-[#111827] hover:bg-black/5"
                    }`}
                  >
                    Modpacks
                    {moddedInstances.length > 0 && <span className="bg-[#D1F4E0] text-[#1FA662] text-[10px] font-bold px-2 py-0.5 rounded-full">{moddedInstances.length}</span>}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-1">
              <button
                onClick={() => switchCategory("discover")}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                  activeCategory === "discover" ? "bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] text-[#111827]" : "text-gray-500 hover:text-[#111827] hover:bg-black/5"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                Discover Mods
              </button>
              
              <button
                onClick={() => switchCategory("settings")}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                  activeCategory === "settings" ? "bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] text-[#111827]" : "text-gray-500 hover:text-[#111827] hover:bg-black/5"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"></path></svg>
                Settings
              </button>
            </div>
          </nav>
        </div>

        {/* Account System Button */}
        <button onClick={startOAuth} className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 hover:shadow-md transition-all active:scale-95 text-left mb-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
              {isLoggedIn ? (
                 <img src="https://minotar.net/helm/Steve/40.png" alt="Skin" />
              ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              )}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold truncate text-[#111827]">{isLoggedIn ? "PlayerName" : "Not Logged In"}</span>
              <span className="text-xs text-gray-500 font-medium truncate">Click to authenticate</span>
            </div>
        </button>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col pt-8 pr-8 pb-8 pl-0 min-w-0" data-tauri-drag-region>
        <div className="flex-1 bg-white rounded-[32px] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] overflow-hidden cursor-default flex flex-col relative w-full">
          
          {/* Header */}
          <div className="px-10 py-8 shrink-0 flex items-center justify-between border-b border-gray-50/50">
            <h2 className="text-[28px] font-bold tracking-tight capitalize">
              {activeCategory === "product" ? `Instances ${activeSubTab}` : activeCategory.replace("-", " ")}
            </h2>
            <button
              onClick={openNewModal}
              className="bg-[#111827] hover:bg-[#1F2937] text-white px-5 py-2.5 rounded-xl font-semibold shadow-md active:scale-95 transition-all text-sm flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              New Instance
            </button>
          </div>

          <div className="flex-1 overflow-y-auto w-full h-full p-10">
            
            {/* OVERVIEW TAB */}
            {activeCategory === "product" && activeSubTab === "overview" && (
              <div className="flex gap-6 h-full">
                <div className="flex-1 flex flex-col gap-6">
                  {/* Instances List (Reused below too, abstracting logic mapping) */}
                  <div className="bg-[#F9FAFB] rounded-[24px] p-6 border border-gray-100 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg mb-6">All Instances</h3>
                    <div className="flex flex-col gap-3">
                      {instances.length === 0 && <p className="text-gray-400 text-sm">No instances found.</p>}
                      {instances.map((instance) => (
                        <div key={instance.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer group">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-400 group-hover:bg-[#111827] group-hover:text-white transition-colors">
                              MC
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-900">{instance.name}</h4>
                              <p className="text-xs text-gray-500 font-medium">{instance.version} • {instance.type}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-semibold text-gray-600 w-12 text-right">{instance.playTime}</span>
                            
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => openEditModal(instance, e)}
                                className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
                                title="Edit Instance"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                              </button>
                              <button
                                onClick={(e) => handleDeleteInstance(instance.name, e)}
                                className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                title="Delete Instance"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); alert(`Launching ${instance.name}...`); }}
                                className="w-10 h-10 rounded-full flex items-center justify-center bg-[#111827] text-white hover:bg-[#10b981] shadow-sm transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="w-80 shrink-0 bg-[#F9FAFB] rounded-[24px] p-6 border border-gray-100 flex flex-col">
                  <h3 className="font-bold text-lg mb-6">Launcher Timeline</h3>
                  <div className="relative border-l-2 border-gray-200 ml-3 pl-5 flex flex-col gap-6 mt-2">
                    <div className="relative">
                      <div className="absolute -left-[27px] top-1 w-[11px] h-[11px] bg-[#1FA662] rounded-full ring-4 ring-[#F9FAFB]"></div>
                      <span className="text-xs font-bold text-gray-400 mb-1 block">Live Status</span>
                      <h5 className="font-bold text-gray-900 text-sm">Auth systems active.</h5>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">Ready to begin Microsoft login flow.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FILTERED TABS (Vanilla/Modpacks) */}
            {activeCategory === "product" && (activeSubTab === "vanilla" || activeSubTab === "modded") && (
              <div className="flex flex-col h-full bg-[#F9FAFB] rounded-[24px] p-8 border border-gray-100">
                <h3 className="font-bold text-2xl mb-6 capitalize">{activeSubTab === "modded" ? "Modpacks" : "Vanilla"} Instances</h3>
                <div className="flex flex-col gap-3 overflow-y-auto pr-2 no-scrollbar">
                  {(activeSubTab === "vanilla" ? vanillaInstances : moddedInstances).length > 0 ? (
                    (activeSubTab === "vanilla" ? vanillaInstances : moddedInstances).map((instance) => (
                      <div key={instance.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-400 group-hover:bg-[#111827] group-hover:text-white transition-colors">MC</div>
                          <div>
                            <h4 className="font-bold text-gray-900 text-lg">{instance.name}</h4>
                            <p className="text-sm text-gray-500 font-medium">{instance.version} • {instance.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <span className="text-sm font-semibold text-gray-600 w-12 text-right">{instance.playTime}</span>
                            
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => openEditModal(instance, e)} className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-50 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors" ><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
                              <button onClick={(e) => handleDeleteInstance(instance.name, e)} className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors" ><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg></button>
                              <button onClick={(e) => { e.stopPropagation(); alert(`Launching ${instance.name}...`); }} className="w-12 h-12 rounded-full flex items-center justify-center bg-[#111827] text-white hover:bg-[#10b981] shadow-sm transition-colors" ><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
                            </div>
                          </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 mt-20">
                      <p>No instances found in this category.</p>
                      <button onClick={openNewModal} className="mt-4 text-[#111827] font-semibold hover:underline">Create one now</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SETTINGS SCRaffold */}
            {activeCategory === "settings" && (
              <div className="flex flex-col max-w-3xl">
                <h3 className="font-bold text-2xl mb-8">Launcher Customization</h3>
                
                <div className="space-y-8">
                   <div className="bg-[#F9FAFB] rounded-[24px] p-8 border border-gray-100 flex flex-col gap-6">
                      <h4 className="font-bold text-lg border-b border-gray-200 pb-2">Minecraft Execution</h4>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Java Executable Path</label>
                        <input type="text" placeholder="Auto-detect (Recommended)" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#111827] transition-all" />
                        <p className="text-xs text-gray-500 mt-2">Leave blank to let Critical Launcher find the best Java version automatically.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Allocated Memory (RAM)</label>
                        <input type="range" min="1024" max="16384" step="1024" defaultValue="4096" className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#111827]" />
                        <div className="flex justify-between text-xs text-gray-500 mt-2 font-bold">
                           <span>1 GB</span>
                           <span className="text-[#111827]">4 GB</span>
                           <span>16 GB</span>
                        </div>
                      </div>
                   </div>

                   <div className="bg-[#F9FAFB] rounded-[24px] p-8 border border-gray-100 flex flex-col gap-6">
                      <h4 className="font-bold text-lg border-b border-gray-200 pb-2">Appearance</h4>
                      
                      <div className="flex items-center justify-between">
                         <div>
                            <span className="block text-sm font-semibold text-gray-700">Theme Mode</span>
                            <span className="text-xs text-gray-500">Switch between light and dark backgrounds.</span>
                         </div>
                         <select className="bg-white border border-gray-200 rounded-xl px-4 py-2 outline-none font-medium">
                            <option>System Default</option>
                            <option>Light</option>
                            <option>Dark (WIP)</option>
                         </select>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* DISCOVER TAB - MODRINTH API SCRAPER */}
            {activeCategory === "discover" && (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex-1 relative">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input 
                      type="text" 
                      value={discoverQuery}
                      onChange={(e) => setDiscoverQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchModrinth(discoverQuery)}
                      placeholder="Search Modrinth for Modpacks..." 
                      className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 outline-none focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all font-medium" 
                    />
                  </div>
                  <button onClick={() => searchModrinth(discoverQuery)} className="bg-[#111827] text-white px-6 py-3.5 rounded-xl font-bold shadow-md hover:bg-[#1F2937] transition-all active:scale-95">
                    Search
                  </button>
                  <select className="bg-[#F9FAFB] border border-gray-200 rounded-xl px-4 py-3.5 outline-none font-medium cursor-pointer">
                    <option>Modrinth</option>
                    <option disabled>CurseForge (Soon)</option>
                    <option disabled>ATLauncher (Soon)</option>
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                  {isSearching ? (
                    <div className="flex items-center justify-center h-full text-gray-400 font-bold">Scraping APIs...</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {modpacks.map((pack) => (
                        <div key={pack.project_id} className="bg-[#F9FAFB] border border-gray-100 rounded-[20px] overflow-hidden hover:shadow-lg transition-all group flex flex-col">
                          <div className="h-32 w-full overflow-hidden bg-gray-200 relative">
                             {pack.icon_url ? <img src={pack.icon_url} alt={pack.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 blur-sm opacity-50" /> : null}
                             {pack.icon_url ? <img src={pack.icon_url} alt={pack.title} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-500" /> : null}
                          </div>
                          <div className="p-5 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-lg text-gray-900 leading-tight mb-1 truncate">{pack.title}</h4>
                              <p className="text-xs text-gray-500 font-medium mb-3">By {pack.author}</p>
                              <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{pack.description}</p>
                            </div>
                            <button className="w-full mt-5 bg-gray-200/50 hover:bg-[#111827] text-gray-700 hover:text-white py-2.5 rounded-xl font-bold transition-colors">
                              Install Pack
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export default App;