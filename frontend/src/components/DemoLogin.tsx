import React from 'react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { mockUser } from '@/data/mockUser';
import { telegramService } from '@/services/telegram';
import { LogIn, UserPlus, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const DemoLogin: React.FC = () => {
  const { login, authenticateWithTelegram } = useUser();
  const navigate = useNavigate();

  const handleDemoLogin = () => {
    login(mockUser);
  };

  const handleTelegramLogin = () => {
    authenticateWithTelegram();
    navigate('/')
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">🎯 BingoBot</h1>
          <p className="text-muted-foreground">
            Welcome to the ultimate multiplayer bingo experience!
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-center text-foreground mb-6">
            Get Started
          </h2>

          {telegramService.isTelegramApp() ? (
            <Button
              onClick={handleTelegramLogin}
              className="w-full flex items-center justify-center space-x-2"
              size="lg"
            >
              <Smartphone className="h-5 w-5" />
              <span>Login with Telegram</span>
            </Button>
          ) : (
            <>
              <Button
                onClick={handleDemoLogin}
                className="w-full flex items-center justify-center space-x-2"
                size="lg"
              >
                <LogIn className="h-5 w-5" />
                <span>Try Demo (Auto-login)</span>
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Demo Account:</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Username: BingoMaster</p>
                  <p>Balance: $150.75</p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2"
                  size="lg"
                >
                  <UserPlus className="h-5 w-5" />
                  <span>Create Account</span>
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            This is a demo application. Click "Try Demo" to explore the features.
          </p>
        </div>
      </div>
    </div>
  );
};
