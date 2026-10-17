import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@chatpilot/database';
import { HybridRoutingResult } from '@chatpilot/contracts';

@Injectable()
export class HybridRoutingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Confirmed hybrid branch-routing rule (Q-REQ-5):
   * (1) Explicit connection mapping routes directly.
   * (2) Single active branch defaults automatically.
   * (3) Multiple active branches requires customer branch selection before ordering.
   * (4) Selected branch is persisted on Conversation.branchId.
   * (5) Branch validated active and company-owned.
   * (6) Order creation strictly blocked while branch resolution is incomplete.
   */
  async resolveBranchRoute(
    companyId: string,
    connectionBranchId: string | null,
    conversationBranchId: string | null,
  ): Promise<HybridRoutingResult> {
    // 1. Direct branch mapping on the WhatsApp connection
    if (connectionBranchId) {
      const directBranch = await this.prisma.branch.findFirst({
        where: { id: connectionBranchId, companyId, isActive: true },
      });
      if (directBranch) {
        return {
          branchId: directBranch.id,
          requiresCustomerSelection: false,
        };
      }
    }

    // 2. Fetch all active branches for this company
    const activeBranches = await this.prisma.branch.findMany({
      where: { companyId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });

    if (activeBranches.length === 0) {
      throw new BadRequestException('No active branches available for this company');
    }

    // 3. Single active branch auto-default
    if (activeBranches.length === 1 && activeBranches[0]) {
      return {
        branchId: activeBranches[0].id,
        requiresCustomerSelection: false,
      };
    }

    // 4. Multiple active branches: inspect persisted conversation selection
    if (conversationBranchId) {
      const selected = activeBranches.find((b) => b.id === conversationBranchId);
      if (selected) {
        return {
          branchId: selected.id,
          requiresCustomerSelection: false,
        };
      }
    }

    // 5. Customer branch selection required before ordering can proceed
    return {
      requiresCustomerSelection: true,
      availableBranches: activeBranches.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
      })),
    };
  }

  /**
   * Sets customer branch selection on conversation after validating company ownership & active status
   */
  async selectBranchForConversation(
    conversationId: string,
    companyId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId, isActive: true },
    });

    if (!branch) {
      throw new BadRequestException('Invalid branch selection: Branch is not active or belongs to another company');
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { branchId: branch.id },
    });
  }
}
