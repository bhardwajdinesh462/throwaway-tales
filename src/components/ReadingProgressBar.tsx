import { motion } from 'framer-motion';

interface ReadingProgressBarProps {
  progress: number;
}

export const ReadingProgressBar = ({ progress }: ReadingProgressBarProps) => {
  return (
    <div 
      className="fixed top-0 left-0 w-full h-1 z-50 bg-muted/30"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      <motion.div
        className="h-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.1, ease: 'easeOut' }}
      />
    </div>
  );
};
