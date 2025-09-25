// components/StatsCard.tsx
interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  color?: 'blue' | 'gray' | 'orange' | 'red' | 'green';
  size?: 'sm' | 'md' | 'lg';
}

export default function StatsCard({ 
  title, 
  value, 
  subtitle, 
  color = 'gray',
  size = 'md' 
}: StatsCardProps) {
  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700 bg-blue-200 bg-blue-600',
    gray: 'from-gray-50 to-gray-100 border-gray-200 text-gray-700 bg-gray-200 bg-gray-600', 
    orange: 'from-orange-50 to-orange-100 border-orange-200 text-orange-700 bg-orange-200 bg-orange-600',
    red: 'from-red-50 to-red-100 border-red-200 text-red-700 bg-red-200 bg-red-600',
    green: 'from-green-50 to-green-100 border-green-200 text-green-700 bg-green-200 bg-green-600'
  };

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6', 
    lg: 'p-8'
  };

  const valueClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl'
  };

  const colors = colorClasses[color].split(' ');
  const gradientClass = `bg-gradient-to-br ${colors[0]} ${colors[1]}`;
  const borderClass = `border ${colors[2]}`;
  const textClass = colors[3];
  const circleOuterClass = colors[4];
  const circleInnerClass = colors[5];

  return (
    <div className={`${gradientClass} rounded-xl shadow-sm ${borderClass} ${sizeClasses[size]}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-medium ${textClass} mb-1`}>
            {title}
          </h3>
          <div className={`${valueClasses[size]} font-bold text-gray-900`}>
            {value}
          </div>
          {subtitle && (
            <p className={`text-xs ${textClass} mt-1`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 ${circleOuterClass} rounded-full flex items-center justify-center`}>
          <div className={`w-6 h-6 ${circleInnerClass} rounded-full`}></div>
        </div>
      </div>
    </div>
  );
}