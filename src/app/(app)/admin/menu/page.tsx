// ==========================================================
// Editor del menú — renombrar, reordenar, mover entre grupos y ocultar
// grupos e ítems. El código define qué ítems existen (ruta y permiso); aquí
// solo se sobreescribe la presentación.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { MENU_BASE, ADMIN_GRUPO, GRUPOS_DESTINO } from "../../_menu";
import { guardarGrupo, guardarItem, restablecerMenu } from "./actions";

export default async function MenuEditorPage() {
  await requirePermiso("parametro.manage");
  const [gruposCfg, itemsCfg] = await Promise.all([
    prisma.menuGrupoCfg.findMany(),
    prisma.menuItemCfg.findMany(),
  ]);
  const gCfg = new Map(gruposCfg.map((g) => [g.clave, g]));
  const iCfg = new Map(itemsCfg.map((i) => [i.href, i]));

  const grupos = [
    ...MENU_BASE.map((g, i) => ({ clave: g.id, defLabel: g.label, defIcon: g.icon, defOrden: i })),
    { clave: ADMIN_GRUPO.id, defLabel: ADMIN_GRUPO.label, defIcon: ADMIN_GRUPO.icon, defOrden: MENU_BASE.length },
  ];
  const items = MENU_BASE.flatMap((g, gi) => g.items.map((it, ii) => ({ href: it.href, defLabel: it.label, defGrupo: g.id, defOrden: gi * 100 + ii })));

  return (
    <>
      {/* Grupos */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Grupos del menú <span className="hact">nombre · ícono · orden · visible</span></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {grupos.map((g) => {
            const c = gCfg.get(g.clave);
            return (
              <form key={g.clave} action={guardarGrupo} className="toolbar" style={{ alignItems: "center" }}>
                <input type="hidden" name="clave" value={g.clave} />
                <input type="text" name="icon" defaultValue={c?.icon ?? g.defIcon} className="select" style={{ width: 60, textAlign: "center" }} aria-label="Ícono" />
                <input type="text" name="label" defaultValue={c?.label ?? g.defLabel} className="select" style={{ minWidth: 180 }} aria-label="Nombre del grupo" />
                <input type="number" name="orden" defaultValue={c?.orden ?? g.defOrden} className="select" style={{ width: 80 }} aria-label="Orden" />
                <label className="flag" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" name="visible" defaultChecked={c ? c.visible : true} /> Visible
                </label>
                <button type="submit" className="btn primary">Guardar</button>
              </form>
            );
          })}
        </div>
      </div>

      {/* Ítems */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Ítems del menú <span className="hact">nombre · grupo · orden · visible</span></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((it) => {
            const c = iCfg.get(it.href);
            return (
              <form key={it.href} action={guardarItem} className="toolbar" style={{ alignItems: "center" }}>
                <input type="hidden" name="href" value={it.href} />
                <input type="text" name="label" defaultValue={c?.label ?? it.defLabel} className="select" style={{ minWidth: 200 }} aria-label="Nombre" />
                <select name="grupoClave" defaultValue={c?.grupoClave ?? it.defGrupo} className="select">
                  {GRUPOS_DESTINO.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
                <input type="number" name="orden" defaultValue={c?.orden ?? it.defOrden} className="select" style={{ width: 80 }} aria-label="Orden" />
                <label className="flag" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" name="visible" defaultChecked={c ? c.visible : true} /> Visible
                </label>
                <span className="flag" style={{ minWidth: 130, opacity: 0.7 }}>{it.href}</span>
                <button type="submit" className="btn primary">Guardar</button>
              </form>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <p className="flag" style={{ margin: 0 }}>
            El orden es ascendente (menor primero). Ocultar no borra la página: sigue accesible por su URL. Las rutas y permisos no se pueden cambiar aquí.
          </p>
          <form action={restablecerMenu} style={{ margin: 0 }}>
            <button type="submit" className="btn">↺ Restablecer menú por defecto</button>
          </form>
        </div>
      </div>
    </>
  );
}
