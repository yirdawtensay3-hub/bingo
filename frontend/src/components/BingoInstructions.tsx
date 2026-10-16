import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Card } from '@/components/ui/card';

type PatternType = 'horizontal' | 'vertical' | 'diagonal' | 'corners' | 'full';

const patternOrder: PatternType[] = ['horizontal', 'vertical', 'diagonal', 'corners', 'full'];

const BingoInstructions: React.FC = () => {
  const [currentPattern, setCurrentPattern] = useState<PatternType>('horizontal');
  const [lineStep, setLineStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const patterns: { [key in PatternType]: { name: string; description: string; positions: number[][] } } = {
    horizontal: {
      name: 'Horizontal Line',
      description: 'Complete any horizontal line to win',
      positions: [
        [0, 1, 2, 3, 4],
        [5, 6, 7, 8, 9],
        [10, 11, 12, 13, 14],
        [15, 16, 17, 18, 19],
        [20, 21, 22, 23, 24]
      ]
    },
    vertical: {
      name: 'Vertical Line',
      description: 'Complete any vertical line to win',
      positions: [
        [0, 5, 10, 15, 20],
        [1, 6, 11, 16, 21],
        [2, 7, 12, 17, 22],
        [3, 8, 13, 18, 23],
        [4, 9, 14, 19, 24]
      ]
    },
    diagonal: {
      name: 'Diagonal Line',
      description: 'Complete either diagonal line to win',
      positions: [
        [0, 6, 12, 18, 24],
        [4, 8, 12, 16, 20]
      ]
    },
    corners: {
      name: 'Four Corners',
      description: 'Mark all four corners to win',
      positions: [[0, 4, 20, 24]]
    },
    full: {
      name: 'Full House',
      description: 'Mark all numbers on your card to win',
      positions: [Array.from({ length: 25 }, (_, i) => i)]
    }
  };

  const currentPatternData = patterns[currentPattern];

  // Cycle through lines and patterns
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setLineStep((prev) => {
        if (prev + 1 < currentPatternData.positions.length) {
          return prev + 1; // next line in same pattern
        } else {
          // move to next pattern
          const currentIndex = patternOrder.indexOf(currentPattern);
          const nextPattern = patternOrder[(currentIndex + 1) % patternOrder.length];
          setCurrentPattern(nextPattern);
          return 0; // reset lineStep for next pattern
        }
      });
    }, 700); // each line blinks for 1.2s

    return () => clearInterval(interval);
  }, [isPlaying, currentPattern]);

  // Reset when pattern changes manually
  useEffect(() => {
    setLineStep(0);
  }, [currentPattern]);

  const renderBingoCard = () => {
    const activeLine = new Set(currentPatternData.positions[lineStep]);

    return (
      <div className="px-7 grid grid-cols-5 gap-1 w-full max-w-md mx-auto">
        {Array.from({ length: 25 }).map((_, index) => (
          <motion.div
            key={index}
            className={`
              aspect-square flex items-center justify-center text-sm font-medium
              ${activeLine.has(index) ? 'bg-primary text-primary-foreground' : 'bg-muted'}
              rounded-md relative overflow-hidden
            `}
            animate={{
              opacity: activeLine.has(index) ? [1, 0.5, 1] : 0.6, // blink
              transition: { duration: .5 }
            }}
          >
            {index === 12 ? 'FREE' : index + 1}
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <Card className="p-3 rounded-b-lg rounded-t-none">
      <div className="flex flex-col items-center">
        <h2 className="text-xl font-bold mb-4">How to Win at Bingo</h2>
        {renderBingoCard()}

        <div className="mt-6 flex space-x-2 flex-wrap justify-center">
          {patternOrder.map((pattern) => (
            <button
              key={pattern}
              className={`px-3 py-1 my-1 rounded-full text-sm font-medium ${currentPattern === pattern
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
                }`}
              onClick={() => {
                setCurrentPattern(pattern);
                setIsPlaying(false);
              }}
            >
              {patterns[pattern].name}
            </button>
          ))}
        </div>

        <button
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? 'Pause' : 'Play'} Animation
        </button>
      </div>
    </Card>
  );
};

export default BingoInstructions;
