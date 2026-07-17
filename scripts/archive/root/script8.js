const fs = require('fs');

const path = 'frontend/src/pages/InventoryStockPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import for CategoryManagementModal
const importCategoryModal = `import CategoryManagementModal from '../components/CategoryManagementModal';`;
content = content.replace(/import Swal from 'sweetalert2';/, `import Swal from 'sweetalert2';\n${importCategoryModal}`);

// 2. Add state isCategoryModalOpen
const stateRegex = /const \[expandedCategories, setExpandedCategories\] = useState\(\{\}\);/;
const stateReplacement = `const [expandedCategories, setExpandedCategories] = useState({});\n    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);`;
content = content.replace(stateRegex, stateReplacement);

// 3. Add button next to select dropdown
const dropdownRegex = /<div className="flex gap-3 w-full sm:w-auto">\n\s*<div className="relative">/;
const dropdownReplacement = `<div className="flex gap-3 w-full sm:w-auto">\n            <button\n              onClick={() => setIsCategoryModalOpen(true)}\n              className="px-4 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm whitespace-nowrap hidden sm:flex items-center gap-2"\n              title="จัดการหมวดหมู่"\n            >\n              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>\n              จัดการหมวดหมู่\n            </button>\n            {/* Mobile icon-only button */}\n            <button\n              onClick={() => setIsCategoryModalOpen(true)}\n              className="px-3 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm sm:hidden flex items-center justify-center"\n              title="จัดการหมวดหมู่"\n            >\n              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>\n            </button>\n\n            <div className="relative">`;
content = content.replace(dropdownRegex, dropdownReplacement);

// 4. Render CategoryManagementModal
const renderRegex = /<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*\);\n\s*};\n\nexport default InventoryStockPage;/;
const renderReplacement = `  </div>\n          </div>\n        </div>\n\n        <CategoryManagementModal \n          isOpen={isCategoryModalOpen} \n          onClose={() => setIsCategoryModalOpen(false)} \n          onCategoryUpdated={() => {\n            fetchCategories();\n            fetchStock();\n          }}\n        />\n\n      </div>\n    );\n  };\n\nexport default InventoryStockPage;`;
content = content.replace(renderRegex, renderReplacement);

fs.writeFileSync(path, content, 'utf8');
