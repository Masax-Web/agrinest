const { expect } = require('chai');
const AuthService = require('../../api/services/AuthService');
const { resolveRoleIdentity } = require('../../api/services/AuthSchema');
const { personas } = require('../../shared/personas.json');
const roleModel = require('../../shared/role-model.json');

describe('Core role and persona identity', () => {
  it('maps legacy persona roles to their core role without losing persona identity', () => {
    for (const coreRole of roleModel.coreRoles) {
      for (const personaId of coreRole.personas) {
        expect(resolveRoleIdentity(personaId)).to.deep.equal({
          role: coreRole.id,
          persona_id: personaId,
        });
      }
    }

    expect(resolveRoleIdentity('farmer')).to.deep.equal({
      role: 'farmer',
      persona_id: 'smallholder_farmer',
    });
    expect(resolveRoleIdentity('admin')).to.deep.equal({
      role: 'admin',
      persona_id: 'ai_model_manager',
    });
  });

  it('preserves valid existing persona assignments and rejects unknown identities', () => {
    expect(resolveRoleIdentity('farmer', 'landowner')).to.deep.equal({
      role: 'farmer',
      persona_id: 'landowner',
    });
    expect(() => resolveRoleIdentity('admin', 'unknown_persona')).to.throw(/unrecognized role/);
    expect(() => resolveRoleIdentity('unknown_role')).to.throw(/unrecognized role/);
  });

  it('returns core role and persona separately and reserves admin access for super admins', () => {
    const farmer = AuthService.publicUser({
      user_id: 'farmer-id',
      role: 'smallholder_farmer',
      role_status: 'active',
    });
    expect(farmer).to.include({ role: 'farmer', persona_id: 'smallholder_farmer', is_admin: false });

    const modelManager = AuthService.publicUser({
      user_id: 'model-manager-id',
      role: 'admin',
      persona_id: 'ai_model_manager',
      role_status: 'active',
    });
    expect(modelManager).to.include({ role: 'admin', persona_id: 'ai_model_manager', is_admin: false });

    const superAdmin = AuthService.publicUser({
      user_id: 'super-admin-id',
      role: 'admin',
      persona_id: 'super_admin',
      role_status: 'active',
    });
    expect(superAdmin).to.include({ role: 'admin', persona_id: 'super_admin', is_admin: true });
  });

  it('keeps self-service persona changes within self-registration farmer personas', async () => {
    try {
      await AuthService.setFarmerPersona({ userId: 'farmer-id', personaId: 'commercial_farmer' });
      throw new Error('Expected review-gated persona to be rejected');
    } catch (error) {
      expect(error.code).to.equal('farmer_persona_requires_review');
    }

    try {
      await AuthService.setFarmerPersona({ userId: 'farmer-id', personaId: 'local_buyer' });
      throw new Error('Expected non-farmer persona to be rejected');
    } catch (error) {
      expect(error.code).to.equal('farmer_persona_required');
    }
  });

  it('rejects mismatched core-role and persona registration before database access', async () => {
    try {
      await AuthService.registerUser({
        name: 'Test Farmer',
        phone: '+255712345678',
        password: 'a-long-valid-password',
        core_role: 'buyer',
        persona_id: 'smallholder_farmer',
      });
      throw new Error('Expected mismatched core role to be rejected');
    } catch (error) {
      expect(error.code).to.equal('persona_core_role_mismatch');
    }
  });

  it('maps every core-role persona to a defined persona entry', () => {
    const personaIds = new Set(personas.map((persona) => persona.id));
    const mappedPersonaIds = roleModel.coreRoles.flatMap((coreRole) => coreRole.personas);
    expect(new Set(mappedPersonaIds).size).to.equal(mappedPersonaIds.length);
    expect(new Set(mappedPersonaIds)).to.deep.equal(personaIds);
    for (const coreRole of roleModel.coreRoles) {
      expect(coreRole.personas).to.include(coreRole.defaultPersona);
      for (const personaId of coreRole.personas) expect(personaIds.has(personaId)).to.equal(true);
    }
  });
});
