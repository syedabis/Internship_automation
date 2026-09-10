'use client';

import { useRef, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// A type-to-filter <Select>, used anywhere a field's options come from a long
// static/fetched list (workshops, universities, domains) rather than a
// handful of choices a plain dropdown can hold comfortably.
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder = 'Search...',
  emptyMessage,
  isLoading = false,
  loadingPlaceholder = 'Loading...',
  triggerClassName,
}) {
  const [search, setSearch] = useState('');
  const searchInputRef = useRef(null);

  const filteredOptions = options.filter((option) => option.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <Select
        value={value}
        onValueChange={(next) => {
          onValueChange(next);
          setSearch('');
        }}
        disabled={isLoading}
        onOpenChange={(open) => {
          if (!open) setSearch('');
        }}
      >
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={isLoading ? loadingPlaceholder : placeholder} />
        </SelectTrigger>
        <SelectContent
          // "popper" (not the default "item-aligned") anchors the popup to the
          // trigger's own bounding box via floating-ui, so it stays put as the
          // list is filtered. "item-aligned" instead positions itself relative
          // to the *selected item's* position in the list — as typing shrinks
          // the filtered list, that reference point moves, and the popup visibly
          // drifts sideways/vertically while you type. Popper mode also exposes
          // a real trigger-width CSS var, so width no longer needs the manual
          // ResizeObserver measuring this used to require.
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
          avoidCollisions={true}
          collisionPadding={10}
          className="z-50 max-h-[45vh] sm:max-h-72 w-[var(--radix-select-trigger-width)] bg-white shadow-xl rounded-lg border border-gray-200"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => {
              searchInputRef.current?.focus();
            }, 50);
          }}
        >
          {!isLoading && options.length > 0 && (
            <div className="sticky top-0 z-10 mb-1 border-b border-gray-100 bg-white px-1 pb-2 pt-1">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                className="w-full h-8 rounded-md border border-gray-200 px-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
              />
            </div>
          )}
          {isLoading ? (
            <div className="px-4 py-2 text-gray-400 text-center text-sm">{loadingPlaceholder}</div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-4 py-2 text-gray-400 text-center text-sm">
              {search ? `No matches for "${search}"` : emptyMessage || 'No options available'}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
