const { execSync } = require('child_process');

const COMPANY_ID = 'k57b750v8kpvhp563zztq8tp057vgypq';
const MINUTES = 20;

async function main() {
  let deleted = 0;
  let batchCount = 0;
  
  while (true) {
    try {
      console.log(`Running batch deletion ${batchCount + 1}...`);
      const output = execSync(`npx convex run appointments:deleteRecentAppointments '{"companyId": "${COMPANY_ID}", "minutes": ${MINUTES}}'`, { encoding: 'utf-8' });
      
      // Output format: [CONVEX ...] [LOG] ... \n <return value>
      // We need to parse the return value (number of deleted items)
      // It usually appears on the last line or so.
      // Let's try to find the number.
      const lines = output.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      const count = parseInt(lastLine, 10);
      
      if (isNaN(count)) {
          console.log("Output:", output);
          console.error("Could not parse deleted count.");
          break;
      }
      
      deleted += count;
      console.log(`Deleted ${count} appointments in this batch.`);
      
      if (count < 1000) {
        break;
      }
      
      batchCount++;
    } catch (e) {
      console.error('Failed to run deletion:', e.message);
      break;
    }
  }
  
  console.log(`Total deleted: ${deleted}`);
}

main();
