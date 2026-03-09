-- AlterTable: Prevent deleting a module that still has entities (Entity.moduleId FK: SetNull -> Restrict)
ALTER TABLE "entities" DROP CONSTRAINT IF EXISTS "entities_module_id_fkey";
ALTER TABLE "entities" ADD CONSTRAINT "entities_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
