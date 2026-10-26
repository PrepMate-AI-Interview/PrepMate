using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using backend.Models.AI;

namespace backend.Services.AI
{
    public interface IComboRootService
    {
        ComboRootConfiguration GetConfiguration();

        ComboRootSlot? GetSlot(int slotIndex);

        ComboRootSlot UpdateSlot(int slotIndex, UpdateComboRootSlotRequest request);

        (string PlaintextKey, string Source, bool IsEnvManaged) ResolveSlotCredential(ComboRootSlot slot);

        ComboRootSlotDto ToDto(ComboRootSlot slot);

        Task<ComboRootSlotDto> ProbeSlotHealthAsync(int slotIndex, CancellationToken cancellationToken = default);

        Task<List<ComboRootSlotDto>> ProbeAllSlotsHealthAsync(CancellationToken cancellationToken = default);
    }
}
