export function ingredientPayload(values) {
 const text=(key,max)=>{const s=String(values[key]??'').trim();if(!s||s.length>max)throw Error('INVALID_PRODUCT');return s;};
 const quantity=(key,positive)=>{const raw=String(values[key]??'').trim();if(!/^\d+(\.\d{1,3})?$/.test(raw))throw Error('INVALID_QUANTITY');const n=Number(raw),m=Math.round(n*1000);if(!Number.isSafeInteger(m)||m>1e12||m<(positive?1:0))throw Error('INVALID_QUANTITY');return m;};
 if(!['g','ml','un','unit'].includes(values.unit))throw Error('INVALID_UNIT');
 return {name:text('name',160),supplier:text('supplier',160),category:text('category',80),warehouse:text('warehouse',120),base_unit:values.unit==='un'?'unit':values.unit,purchase_unit_label:text('purchaseUnit',100),purchase_factor_milli:quantity('factor',true),min_stock_milli:quantity('minimum',false)};
}
export function createInventoryCatalog(client) {
 let owner=null,epoch=0,busy=false;
 return {
  setOwner(id){if(owner!==id){owner=id;epoch++;busy=false;}},
  async list(){const id=owner,e=epoch;if(!id)throw Error('SIGN_IN_REQUIRED');
   const [items,warehouses]=await Promise.all([
    client.from('rc_inventory_ingredients').select('*').eq('restaurant_id',id).order('name').limit(1000),
    client.from('rc_inventory_warehouses').select('id,name').eq('restaurant_id',id).order('name').limit(1000)
   ]);
   if(e!==epoch)throw Error('SESSION_CHANGED');if(items.error)throw items.error;if(warehouses.error)throw warehouses.error;
   return {items:items.data,warehouses:warehouses.data};
  },
  async save(id,version,data){if(busy)throw Error('SAVE_IN_PROGRESS');if(!owner)throw Error('SIGN_IN_REQUIRED');
   const captured=owner,e=epoch;busy=true;
   try {const {data:result,error}=await client.rpc('rc_inventory_save_ingredient',{p_restaurant:captured,p_id:id,p_expected_version:version,p_data:data});
    if(e!==epoch)throw Error('SESSION_CHANGED');if(error)throw error;
    if(!result||result.id!==id||result.restaurant_id!==captured)throw Error('INVALID_SAVE_RESPONSE');return result;
   } finally {if(e===epoch)busy=false;}
  }
 };
}
