export default function FilterBar({ filters, onChange }) {
  function handleChange(key, value) {
    onChange((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="filter-bar">
      {filters.map((filter) => (
        <label key={filter.key} className="filter-label">
          <span>{filter.label}</span>
          {filter.options ? (
            <select
              value={filter.value || ""}
              onChange={(e) => handleChange(filter.key, e.target.value)}
            >
              <option value="">全部</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={filter.value || ""}
              onChange={(e) => handleChange(filter.key, e.target.value)}
              placeholder={filter.placeholder || ""}
            />
          )}
        </label>
      ))}
    </div>
  );
}
