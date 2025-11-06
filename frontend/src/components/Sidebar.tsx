import { NavLink } from "@/components/NavLink";

interface SidebarProps {
  hideIcons?: boolean;
}

const Sidebar = ({ hideIcons = false }: SidebarProps) => {
  return (
    <aside className="fixed left-0 top-0 h-full w-20 flex flex-col items-center py-6 gap-4 z-50">
      {/* Logo */}
      {!hideIcons && (
        <NavLink to="/" className="mb-4">
          <div className="w-10 h-10 glass rounded-xl flex items-center justify-center">
            <svg 
              viewBox="0 0 24 24" 
              className="w-6 h-6 text-white" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {/* Star constellation / hypersearch warp effect */}
              <path d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z"/>
              <circle cx="12" cy="11" r="1.5" fill="currentColor"/>
            </svg>
          </div>
        </NavLink>
      )}

    </aside>
  );
};

export default Sidebar;
