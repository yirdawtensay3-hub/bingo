import React, { useEffect } from 'react';
// import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { User, DollarSign, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel
} from './ui/alert-dialog';

interface NavbarProps {
  currentView?: string;
  roomInfo?: {
    name: string;
    stake: number;
    players: number;
    totalPlayers: number;
    prizePool: number;
  };
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
}) => {
  // const { theme, toggleTheme } = useTheme();
  const { user, refreshBalance } = useUser();

  // const handleLogout = () => {
  //   logout();
  // };

  useEffect(() => { refreshBalance() }, [])
  const navigator = useNavigate();
  const handleUserProfile = async () => {
    await refreshBalance();
    navigator('/profile');
  }

  const showBackButton = location.pathname !== '/rooms';
  const [leaveAlertOpen, setLeaveAlertOpen] = React.useState(false);
  const handleBack = () => {
    if (currentView === 'playground') {
      setLeaveAlertOpen(true);
      return;
    }
    navigator(-1);
  }

  return (
    <>
      <AlertDialog open={leaveAlertOpen} onOpenChange={setLeaveAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave or Forfeit Game?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave or forfeit the game? Your progress may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLeaveAlertOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction>Yes, leave game</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <header className="sticky top-0 z-50 w-full border-b backdrop-blur-lg bg-background/60">
        <nav className="container flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center justify-start w-1/3">
            {showBackButton && (
              <Button
                onClick={handleBack}
                variant="ghost"
                size="sm"
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Back</span>
              </Button>
            )}
            {!showBackButton && (
              <img src="/images/goat_logo_bg_rm.png" alt="Logo" className="h-12 w-auto" />
            )
            }
          </div>

          <div className="flex items-center justify-end">
            {/* User Profile Section */}
            {user ? (
              <div className="flex items-center space-x-4">
                {/* Balance Display */}
                <div className="flex items-center space-x-2 bg-primary/10 dark:bg-primary/20 px-3 py-2 rounded-lg">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-primary text-sm">
                    {(user.balance || 0).toFixed(2)} birr
                  </span>
                </div>

                {/* User Avatar and Info */}
                <div className="md:hidden" onClick={handleUserProfile}>
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
                <div className="hidden md:flex items-center space-x-3 bg-secondary px-4 py-2 rounded-lg" onClick={handleUserProfile}>
                  <div className="flex w-8 h-8 bg-primary rounded-full items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.username}</p>
                  </div>
                </div>

                {/* Logout Button */}
                {/* <Button */}
                {/*   variant="outline" */}
                {/*   size="sm" */}
                {/*   onClick={handleLogout} */}
                {/*   className="flex items-center space-x-2" */}
                {/* > */}
                {/*   <LogOut className="h-4 w-4" /> */}
                {/*   <span className="hidden sm:inline">Logout</span> */}
                {/* </Button> */}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  Login
                </Button>
                <Button size="sm">
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </nav>
      </header>
    </>
  );
};
