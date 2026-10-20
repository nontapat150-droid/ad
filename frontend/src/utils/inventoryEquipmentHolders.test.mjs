import assert from 'node:assert/strict';
import test from 'node:test';
import { groupEquipmentByHolder } from './inventoryEquipmentHolders.js';

test('groupEquipmentByHolder totals equipment by technician', () => {
  assert.deepEqual(groupEquipmentByHolder([
    { owner_id: 7, owner_name: 'ช่างเอ', team_name: 'ทีมเหนือ', product_name: 'ONU', quantity: 2, item_count: 2, sn_count: 2 },
    { owner_id: 7, owner_name: 'ช่างเอ', team_name: 'ทีมเหนือ', product_name: 'สาย', quantity: 50, item_count: 1, sn_count: 0 },
    { owner_id: 8, owner_name: 'ช่างบี', team_name: 'ทีมใต้', product_name: 'ONU', quantity: 1, item_count: 1, sn_count: 1 },
  ]), [
    { ownerId: 7, ownerName: 'ช่างเอ', teamName: 'ทีมเหนือ', quantity: 52, itemCount: 3, snCount: 2, rows: [
      { owner_id: 7, owner_name: 'ช่างเอ', team_name: 'ทีมเหนือ', product_name: 'ONU', quantity: 2, item_count: 2, sn_count: 2 },
      { owner_id: 7, owner_name: 'ช่างเอ', team_name: 'ทีมเหนือ', product_name: 'สาย', quantity: 50, item_count: 1, sn_count: 0 },
    ] },
    { ownerId: 8, ownerName: 'ช่างบี', teamName: 'ทีมใต้', quantity: 1, itemCount: 1, snCount: 1, rows: [
      { owner_id: 8, owner_name: 'ช่างบี', team_name: 'ทีมใต้', product_name: 'ONU', quantity: 1, item_count: 1, sn_count: 1 },
    ] },
  ]);
});
