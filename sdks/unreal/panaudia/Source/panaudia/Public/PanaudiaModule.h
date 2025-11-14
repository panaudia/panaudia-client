#pragma once

#include "HAL/Platform.h"
#include "Modules/ModuleManager.h"

class FPanaudiaModule : public IModuleInterface
{
public:
    /** IModuleInterface implementation */
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;

private:
    /** Handle to the loaded libdatachannel library */
    void* LibDataChannelHandle;
};