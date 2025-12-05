'use client';

interface EventTypeFilterProps {
  eventTypes: string[];
  selectedEventType: string;
  onEventTypeChange: (eventType: string) => void;
}

export function EventTypeFilter({
  eventTypes,
  selectedEventType,
  onEventTypeChange,
}: EventTypeFilterProps) {
  return (
    <div>
      <label htmlFor="event-type" className="block text-sm font-medium text-gray-700 mb-2">
        Event Type
      </label>
      <select
        id="event-type"
        value={selectedEventType}
        onChange={(e) => onEventTypeChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <option value="">All Event Types</option>
        {eventTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </div>
  );
}
