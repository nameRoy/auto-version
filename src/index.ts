import { AutoVersion } from "./auto-version.js"
import { LifeCycle } from "./life-cycle.js"

const AV = new AutoVersion();
const LC = new LifeCycle(AV)
LC.start()