import HalaqaCard from "./HalaqaCard";

type Halaqa = {
  id: number;
  name: string; // لازم نضيف الاسم
  teacher: string;
  students: number;
};

interface HalaqaGridProps {
  halaqat: Halaqa[];
  onSelect: (id: number, name: string) => void;
}

export default function HalaqaGrid({ halaqat, onSelect }: HalaqaGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {halaqat.map((h) => (
        <HalaqaCard
          key={h.id}
          name={h.name}
          teacher={h.teacher}
          students={h.students}
          onClick={() => onSelect(h.id, h.name)} // نمرر الـ id والاسم
        />
      ))}
    </div>
  );
}