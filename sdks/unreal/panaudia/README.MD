
# Panaudia Unreal Plugin

A spatial audio plugin for Unreal Engine that provides real-time voice communication with 3D positional audio using WebRTC.

## Overview

Panaudia enables developers to add spatial audio capabilities to their Unreal Engine projects with minimal setup. The plugin handles:

- **Real-time Audio Communication** - Low-latency voice chat using WebRTC
- **3D Spatial Audio** - Binaural audio rendering based on player position and orientation
- **Automatic Position Tracking** - Seamless synchronization of audio sources with actor positions
- **Adaptive Jitter Buffer** - Dynamic audio buffering for optimal quality across varying network conditions
- **Auto-Reconnection** - Reliable connection management with automatic retry logic

## Features

- **Blueprint and C++ Support** - Full API access from both Blueprint visual scripting and C++
- **Easy Integration** - Add spatial audio with a single component
- **Flexible Configuration** - Extensive properties for fine-tuning audio quality and network behavior
- **Cross-Platform** - Supports Windows and macOS
- **WebRTC-Based** - Industry-standard real-time communication protocol
- **Custom Attributes** - Attach metadata to connections for game-specific logic

## Quick Start

### Blueprint

1. Add a `PanaudiaAudioComponent` to your player character
2. In BeginPlay, create a `FPanaudiaConnectionConfig` with your session ticket
3. Call `Connect` on the component

That's it! The component automatically handles microphone capture and position updates.

### C++
```cpp 
#include "Panaudia.h"

// In your character 
class UPROPERTY(VisibleAnywhere, Category = "Audio") UPanaudiaAudioComponent* PanaudiaAudio;

// In constructor 
PanaudiaAudio = CreateDefaultSubobject(TEXT("PanaudiaAudio"));

// In BeginPlay 
FPanaudiaConnectionConfig Config; 
Config.Ticket = TEXT("your-session-ticket"); 
PanaudiaAudio->Connect(Config);
```

## Documentation

- **[Usage Guide](USAGE_GUIDE.md)** - Comprehensive guide with examples for Blueprint and C++
    - Getting started tutorial
    - Basic and advanced usage patterns
    - Common implementation patterns (VR, multiplayer lobbies, push-to-talk)
    - Troubleshooting guide

- **[API Reference](API_REFERENCE.md)** - Complete API documentation
    - All public classes, methods, and properties
    - Detailed parameter descriptions
    - Return value documentation
    - Event delegate signatures

## Requirements

- **Unreal Engine** - 5.0 or later (tested with 5.3+)
- **Platforms** - Windows (x64), macOS (Universal Binary)
- **Build Tools**:
    - Windows: Visual Studio 2022, Perl (for OpenSSL)
    - macOS: Xcode Command Line Tools, CMake

## Installation

1. Clone or download this plugin to your project's `Plugins` directory
2. Build the third-party libraries (first time only):
    - **Windows**: Run `Source/ThirdParty/build_third_party_all_windows.bat`
    - **macOS**: Run `Source/ThirdParty/build_third_party_all_mac.sh`
3. Regenerate your project files
4. Build your project

The plugin will be automatically enabled when you build your project.

## Platform Support

| Platform | Status | Architecture |
|----------|--------|--------------|
| Windows  | ✅ Supported | x64 |
| macOS    | ✅ Supported | Universal (x64 + ARM64) |
| Linux    | 🚧 Planned | - |
| iOS      | 🚧 Planned | - |
| Android  | 🚧 Planned | - |

## Key Components

### UPanaudiaAudioComponent

The main component that handles all audio functionality:
- Audio capture and playback
- WebRTC connection management
- Position synchronization
- Jitter buffer control
- Node muting/unmuting

### Data Types

- `FPanaudiaConnectionConfig` - Connection configuration
- `FPanaudiaNodeState` - 3D position and rotation state
- `EPanaudiaConnectionStatus` - Connection status enum

## License

[Your License Here]

## Support

For issues, questions, or feature requests, please visit:
- GitHub Issues: [Your Repository URL]
- Documentation: [Your Docs URL]
- Website: https://panaudia.com

## Third-Party Libraries

This plugin uses the following open-source libraries:
- **libdatachannel** - WebRTC data channels and media
- **OpenSSL** - Cryptography and SSL/TLS
- **Opus** - Audio codec
- **libsrtp** - Secure RTP
- **usrsctp** - SCTP protocol
- **libjuice** - ICE protocol

## Credits

Developed by [Your Name/Company]

Built with ❤️ for the Unreal Engine community.

