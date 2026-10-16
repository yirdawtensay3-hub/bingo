# 🎯 BingoBot - Multiplayer Bingo Website

A modern, responsive multiplayer bingo website built with React, TypeScript, and Tailwind CSS.

## ✨ Features

### 🎮 Core Functionality
- **Multiplayer Bingo Rooms**: Join existing rooms or create new ones
- **Stake-based Gaming**: Different room stakes from $1 to $200+
- **Real-time Status**: See room status (waiting, playing, finished)
- **Player Management**: Track current players vs. max capacity
- **Cartela Selection**: Grid-based selection from 100 available bingo cards
- **Interactive Playground**: Full bingo game interface with called numbers
- **Smart History Display**: Horizontal layout focusing on latest called numbers

### 👤 User Experience
- **User Profiles**: Display username, email, and avatar
- **Balance Tracking**: Real-time balance display with dollar formatting
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### 🎨 Theme System
- **Dark/Light Mode**: Toggle between themes with persistent storage
- **Modern UI**: Clean, intuitive interface with smooth transitions
- **Accessibility**: Proper ARIA labels and keyboard navigation

### 🔍 Room Discovery
- **Advanced Filtering**: Filter by stake amount and room status
- **Search Functionality**: Find rooms by name
- **Smart Sorting**: Rooms organized by availability and stake
- **Card Selection**: Grid-based selection from 100 unique bingo cards
- **Game Flow**: Seamless transition from room selection to gameplay

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production
```bash
npm run build
npm run preview
```

## 🏗️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Button, etc.)
│   ├── Navbar.tsx      # Navigation with user profile & theme toggle
│   ├── RoomCard.tsx    # Individual room display component
│   └── RoomsList.tsx   # Main rooms listing with filters
├── contexts/            # React Context providers
│   ├── ThemeContext.tsx # Dark/light mode management
│   └── UserContext.tsx  # User data and authentication
├── data/                # Mock data and interfaces
│   ├── mockRooms.ts    # Sample bingo rooms
│   └── mockUser.ts     # Sample user data
├── lib/                 # Utility functions
└── App.tsx             # Main application component
```

## 🎯 Key Components

### ThemeContext
- Manages dark/light mode state
- Persists theme preference in localStorage
- Automatically applies theme classes to document

### UserContext
- Handles user authentication state
- Manages user balance updates
- Provides login/logout functionality

### Navbar
- Displays user profile information
- Shows current balance prominently
- Theme toggle button
- Responsive design for mobile

### RoomsList
- Displays all available bingo rooms
- Advanced filtering and search
- Create room functionality
- Responsive grid layout

### RoomCard
- Individual room information display
- Join room functionality
- Balance validation
- Status indicators

## 🎨 Styling

The project uses Tailwind CSS v4 with:
- Custom color scheme with dark mode support
- Responsive design utilities
- Smooth transitions and hover effects
- Consistent spacing and typography

## 🔧 Customization

### Adding New Room Types
Edit `src/data/mockRooms.ts` to add new room configurations.

### Modifying Stakes
Update the stake filter logic in `RoomsList.tsx` to adjust stake ranges.

### Theme Colors
Modify CSS variables in `src/index.css` to customize the color scheme.

## 🚧 Future Enhancements

- [ ] Real-time WebSocket connections
- [ ] Actual bingo game implementation
- [ ] User authentication backend
- [ ] Payment processing integration
- [ ] Leaderboards and statistics
- [ ] Chat functionality in rooms
- [ ] Mobile app version

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ using React, TypeScript, and Tailwind CSS
