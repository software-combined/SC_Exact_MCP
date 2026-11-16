import { readFileSync } from "node:fs";
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";

function template(name: string) {
  const document = parseDocument(readFileSync(`infra/${name}.yaml`, "utf8"), {
    customTags: ["!Ref", "!GetAtt", "!Sub", "!GetAZs"].map((tag) => ({ tag, resolve: (value: string) => value })) });
  expect(document.errors).toEqual([]);
  return document.toJS();
}
describe("production deployment safety", () => {
  it("uses the hosted container, explicit shared-state quotas, and separate task/execution roles", () => {
    const t = template("production");
    const container = t.Resources.Task.Properties.ContainerDefinitions[0];
    const env = Object.fromEntries(container.Environment.map((item: { Name: string; Value: unknown }) => [item.Name, item.Value]));
    expect(env.SCG_ENVIRONMENT).toBe("production"); expect(env.SCG_STATE_TABLE).toBe("State");
    expect(env.SCG_EXACT_APP_ID).toBe("ExactAppId");
    expect(Object.keys(env)).not.toContain("EXACT_REFRESH_TOKEN");
    expect(t.Parameters.AppCallsPerDay.Default).toBeUndefined();
    expect(t.Parameters.AppCallsPerMinute.MinValue).toBe(8);
    expect(t.Parameters.AppCallsPerDay.MinValue).toBe(8);
    expect(t.Parameters.DivisionCallsPerDay.Default).toBeUndefined();
    const image = (region: string) => `123456789012.dkr.ecr.${region}.amazonaws.com/fixture@sha256:${"a".repeat(64)}`;
    const allowedImage = new RegExp(t.Parameters.ImageUri.AllowedPattern);
    expect(allowedImage.test(image("eu-central-1"))).toBe(true);
    expect(allowedImage.test(image("eu-west-1"))).toBe(true);
    expect(allowedImage.test(image("us-east-1"))).toBe(false);
    expect(JSON.stringify(t.Rules.ApprovedEuropeOnly.Assertions)).toContain("eu-central-1");
    expect(JSON.stringify(t.Rules.ApprovedEuropeOnly.Assertions)).toContain("eu-west-1");
    const executionActions = JSON.stringify(t.Resources.ExecutionRole.Properties.Policies);
    expect(executionActions).not.toContain("secretsmanager:GetSecretValue");
    const taskActions = JSON.stringify(t.Resources.TaskRole.Properties.Policies);
    expect(taskActions).not.toContain("ecr:GetAuthorizationToken");
    expect(taskActions).toContain("kms:EncryptionContext:principal");
    expect(taskActions).toContain("kms:EncryptionContext:aws:dynamodb:tableName");
    expect(taskActions).toContain("kms:EncryptionContext:aws:dynamodb:subscriberId");
    expect(container.ReadonlyRootFilesystem).toBe(true);
    expect(t.Parameters.DesiredCount.MinValue).toBe(2);
    expect(t.Parameters.DesiredCount.Default).toBe(2);
    expect(t.Resources.Service.Properties.AvailabilityZoneRebalancing).toBe("ENABLED");
    expect(t.Resources.Service.Properties.EnableECSManagedTags).toBe(true);
    expect(t.Resources.Service.Properties.PropagateTags).toBe("TASK_DEFINITION");
    expect(t.Resources.Task.Properties.Tags.map((tag: { Key: string }) => tag.Key)).toContain("ReviewBy");
  });
  it("provides private egress, DNS validation, an empty config secret, and retained data prerequisites", () => {
    const t = template("foundation");
    expect(t.Resources.NatA.Properties.SubnetId).toBe("PublicA");
    expect(t.Resources.NatB.Properties.SubnetId).toBe("PublicB");
    expect(t.Resources.NatRouteA.Properties.NatGatewayId).toBe("NatA");
    expect(t.Resources.NatRouteB.Properties.NatGatewayId).toBe("NatB");
    expect(t.Resources.PrivateAssociationA.Properties.RouteTableId).toBe("PrivateRoutesA");
    expect(t.Resources.PrivateAssociationB.Properties.RouteTableId).toBe("PrivateRoutesB");
    expect(t.Resources.Certificate.Properties.ValidationMethod).toBe("DNS");
    expect(t.Resources.ConfigSecret.Properties.SecretString).toBeUndefined();
    expect(t.Resources.ConfigSecret.DeletionPolicy).toBe("Retain");
    expect(t.Resources.Repository.Properties.ImageTagMutability).toBe("IMMUTABLE");
    expect(t.Resources.Repository.Properties.LifecyclePolicy).toBeUndefined();
  });
  it("limits optional new-account audit to retained private management events", () => {
    const t = template("audit");
    expect(t.Resources.Trail.Properties.IsOrganizationTrail).toBe(false);
    expect(t.Parameters.TrailName).toBeUndefined();
    expect(t.Resources.Trail.Properties.TrailName).toBe("AWS::StackName");
    const trailArn = "arn:${AWS::Partition}:cloudtrail:${AWS::Region}:${AWS::AccountId}:trail/${AWS::StackName}";
    const keyDelivery = t.Resources.AuditKey.Properties.KeyPolicy.Statement.filter((s: { Principal: { Service?: string } }) => s.Principal.Service === "cloudtrail.amazonaws.com");
    const bucketDelivery = t.Resources.AuditBucketPolicy.Properties.PolicyDocument.Statement.filter((s: { Principal: { Service?: string } }) => s.Principal.Service === "cloudtrail.amazonaws.com");
    expect(keyDelivery).toHaveLength(2); expect(bucketDelivery).toHaveLength(2);
    for (const statement of [...keyDelivery, ...bucketDelivery]) expect(statement.Condition.StringEquals["aws:SourceArn"]).toBe(trailArn);
    expect(keyDelivery[0].Condition.StringLike["kms:EncryptionContext:aws:cloudtrail:arn"]).toBe(trailArn.replace("${AWS::Region}", "*"));
    expect(t.Resources.Trail.Properties.EnableLogFileValidation).toBe(true);
    expect(t.Resources.Trail.Properties.IsMultiRegionTrail).toBe(true);
    expect(t.Resources.Trail.Properties.EventSelectors).toEqual([{ IncludeManagementEvents: true, ReadWriteType: "All" }]);
    expect(t.Resources.AuditBucket.Properties.VersioningConfiguration.Status).toBe("Enabled");
    expect(t.Resources.AuditBucket.Properties.LifecycleConfiguration).toBeUndefined();
    expect(t.Resources.AuditBucket.DeletionPolicy).toBe("Retain");
    expect(t.Resources.AuditBucketPolicy.DeletionPolicy).toBe("Retain");
    expect(t.Resources.AuditBucketPolicy.UpdateReplacePolicy).toBe("Retain");
    expect(t.Rules.DedicatedAccountOnly.Assertions).toHaveLength(3);
  });
});
