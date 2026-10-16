import React from 'react';
import { Card, CardContent } from './card';
import { Button } from './button';
import { X } from 'lucide-react';
import { checkCartela } from '@/lib/utils';

export interface BingoCardProps {
  id: string | number;
  numbers: number[][];
  showBingoStatus?: boolean;
  className?: string;
  onCardClick?: (cardId: string | number) => void;
  onRemove?: (cardId: number) => Promise<void>;
  isSelected?: boolean;
  isInteractive?: boolean;
  showRemoveButton?: boolean;
  calledNumbers?: number[]; // Numbers called by the server
}

export const BingoCard: React.FC<BingoCardProps> = ({
  id,
  numbers,
  showBingoStatus = true,
  className = '',
  onCardClick,
  onRemove,
  isSelected = false,
  isInteractive = false,
  showRemoveButton = false,
  calledNumbers = [],
}) => {
  const handleCardClick = () => {
    if (onCardClick && isInteractive) {
      onCardClick(id);
    }
  };

  const checkBingo = (cardNumbers: number[][]): boolean => {
    // Convert 2D array (columns) to flat array for checkCartela
    // cardNumbers is organized as [col0, col1, col2, col3, col4]
    // where each col is [row0, row1, row2, row3, row4]
    // We need to convert to row-major order: [row0col0, row1col0, ..., row4col4]
    const flatNumbers: number[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        // Use absolute value to get the actual number (in case it's marked as negative)
        flatNumbers.push(Math.abs(cardNumbers[row][col]));
      }
    }

    // Use checkCartela from utils with server's called numbers
    // calledNumbers = numbers streamed by the server
    // flatNumbers = this card's board numbers in flat form
    const hits = checkCartela(calledNumbers, flatNumbers);
    return hits > 0;
  };

  const getNumberCellClass = (num: number): string => {
    // Negative numbers are marked/called numbers
    if (num < 0) return 'bg-green-500 text-white font-bold';
    // 0 is the free space
    if (num === 0) return 'bg-yellow-500 text-yellow-900 font-bold';
    // Positive numbers are unmarked
    return 'bg-secondary text-foreground';
  };

  const getNumberDisplay = (num: number): string => {
    if (num === 0) return '★';
    // For marked numbers (negative values), display the absolute value
    if (num < 0) return Math.abs(num).toString();
    return num.toString();
  };

  const headerColors = [
    'bg-red-500 text-white',    // B
    'bg-orange-500 text-black', // I
    'bg-green-500 text-white',  // N
    'bg-blue-500 text-white',   // G
    'bg-purple-500 text-white', // O
  ];

  return (
    <Card
      className={`${className} ${isInteractive ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''} relative`}
      onClick={handleCardClick}
    >
      {/* Remove Button */}
      {showRemoveButton && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id as number);
          }}
          className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 z-10"
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      <CardContent className="flex flex-col p-3">
        <div className="text-center mb-3">
          <span className="text-sm font-medium text-muted-foreground">
            Card #{id}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1">
          {['B', 'I', 'N', 'G', 'O'].map((letter, colIndex) => (
            <div key={letter} className={`flex flex-col items-center text-center`}>
              <div className={`flex flex-col items-center justify-center font-bold w-full aspect-[2/1] text-center text-primary text-sm mb-1  ${headerColors[colIndex]}`}>{letter}</div>
              {numbers[colIndex].map((num, rowIndex) => (
                <div
                  key={`${colIndex}-${rowIndex}`}
                  className={`aspect-square w-full m-auto flex items-center justify-center rounded text-sm font-medium mb-1 transition-all ${getNumberCellClass(num)}`}
                >
                  {getNumberDisplay(num)}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Bingo Status */}
        {showBingoStatus && checkBingo(numbers) && (
          <div className="mt-3 text-center">
            <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
              🎉 BINGO! 🎉
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
